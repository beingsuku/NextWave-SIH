const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { prisma } = require("../config/db");

async function login(req, res) {
  try {
    const { officerId, password } = req.body;

    if (!officerId || !password) {
      return res.status(400).json({
        success: false,
        message: "officerId and password are required"
      });
    }

    const officer = await prisma.officer.findUnique({
      where: { officerId }
    });

    if (!officer || !officer.active) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      officer.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      {
        id: officer.id,
        officerId: officer.officerId,
        role: officer.role,
        checkpoint: officer.checkpoint
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      success: true,
      data: {
        token,
        officer: {
          id: officer.id,
          officerId: officer.officerId,
          name: officer.name,
          email: officer.email,
          role: officer.role,
          checkpoint: officer.checkpoint
        }
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

async function me(req, res) {
  try {
    const officer = await prisma.officer.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        officerId: true,
        name: true,
        email: true,
        role: true,
        checkpoint: true,
        active: true
      }
    });

    if (!officer) {
      return res.status(404).json({
        success: false,
        message: "Officer not found"
      });
    }

    return res.json({
      success: true,
      data: officer
    });
  } catch (error) {
    console.error("ME ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve profile"
    });
  }
}

async function logout(req, res) {
  // JWTs are stateless here — there is no server-side session to destroy.
  // The client is responsible for discarding the token. If you need real
  // revocation later, add a token-blacklist table and check it in
  // middleware/auth.js.
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
