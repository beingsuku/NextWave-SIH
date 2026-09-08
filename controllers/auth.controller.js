const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { prisma } = require("../config/db");

async function login(req, res) {
  try {
    const { officerId, password } = req.body;

    if (!officerId || !password) {
      return res.status(400).json({
        success: false,
        message: "Officer ID and password are required"
      });
    }

    // Look up officer in DB
    const officer = await prisma.officer.findUnique({
      where: { officerId }
    });

    if (!officer) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Compare password
    const valid = await bcrypt.compare(password, officer.passwordHash);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: officer.id,
        officerId: officer.officerId,
        name: officer.name,
        role: officer.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      success: true,
      token,
      officer: {
        id: officer.id,
        officerId: officer.officerId,
        name: officer.name,
        role: officer.role,
        checkpoint: officer.checkpoint
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
}

function me(req, res) {
  // req.user is set by the authenticate middleware
  return res.json({
    success: true,
    officer: req.user
  });
}

function logout(req, res) {
  // JWT is stateless — client should discard the token
  return res.json({
    success: true,
    message: "Logged out"
  });
}

module.exports = {
  login,
  me,
  logout
};
