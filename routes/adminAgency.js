// routes/adminAgency.js
import express from "express";
import Agency from "../models/Agency.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Middleware: check if user is Admin
const adminAuth = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });

    // 👇 assume decoded.role === "admin" is set when admin logs in
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Not an admin" });
    }

    req.adminId = decoded.id;
    next();
  });
};

// Update Agency Level
router.put("/agency/:id/level", adminAuth, async (req, res) => {
  try {
    const { level } = req.body;
    if (![0, 1, 2, 3, 4].includes(level)) {
      return res.status(400).json({ message: "Invalid level" });
    }

    const agency = await Agency.findByIdAndUpdate(
      req.params.id,
      { agencyLevel: level },
      { new: true }
    );

    if (!agency) return res.status(404).json({ message: "Agency not found" });

    res.json({ message: "Agency level updated", agency });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
