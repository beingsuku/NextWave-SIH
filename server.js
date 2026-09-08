const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const { connectDB } = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend from /front directory
app.use(express.static(path.join(__dirname, "front")));

// API Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/screening", require("./routes/screening.routes"));
app.use("/api/report", require("./routes/report.routes"));
app.use("/api/analytics", require("./routes/analytics.routes"));
app.use("/api", require("./routes/system.routes"));

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "SIH Backend running"
    });
});

// Serve frontend SPA
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "front", "index.html"));
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`SIH Backend running at http://localhost:${PORT}`);
    });
});