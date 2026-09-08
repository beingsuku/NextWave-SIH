const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ quiet: true });

const { connectDB } = require("./config/db");

const authRoutes = require("./routes/auth.routes");
const screeningRoutes = require("./routes/screening.routes");
const reportRoutes = require("./routes/report.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const systemRoutes = require("./routes/system.routes");

const app = express();

app.use(cors());
app.use(express.json());

// Frontend lives in public/ ONLY — do not point this at __dirname,
// that would serve .env, prisma/, controllers/, etc. over HTTP.
app.use(express.static(path.join(__dirname, "public")));

// Quick liveness check (kept separate from /api/system/health,
// which does a real DB-backed health check)
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "SIH Backend connected successfully"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/screening", screeningRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/system", systemRoutes);

// Open SIH frontend
app.get("/", (req, res) => {
    const publicIndex = path.join(__dirname, "public", "index.html");
    if (fs.existsSync(publicIndex)) {
        return res.sendFile(publicIndex);
    }
    res.sendFile(path.join(__dirname, "index.html"));
});

// Global JSON error handler
app.use((err, req, res, next) => {
    console.error("API Error:", err.message || err);
    if (err.name === "MulterError") {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: `File too large. Maximum size allowed is ${process.env.MAX_FILE_SIZE_MB || 10}MB`
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    const statusCode = err.status || err.statusCode || 500;
    return res.status(statusCode).json({
        success: false,
        message: err.message || "Internal server error"
    });
});

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`SIH Backend running at http://localhost:${PORT}`);
    });
});