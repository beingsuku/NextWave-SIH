const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// Your frontend is inside backend/front
app.use(express.static(path.join(__dirname, "front")));

// Test backend
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "SIH Backend connected successfully"
    });
});

// Open SIH frontend
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "front", "sih.html"));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`SIH Backend running at http://localhost:${PORT}`);
});