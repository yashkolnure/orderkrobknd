const jwt = require("jsonwebtoken");
const Agency = require("../models/Agency"); // adjust path if needed

const verifyAgency = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const agency = await Agency.findById(decoded.id);
    if (!agency) {
      return res.status(401).json({ message: "Invalid agency token" });
    }

    req.user = agency; // attach agency info to req
    next();
  } catch (err) {
    console.error("verifyAgency error:", err);
    return res.status(401).json({ message: "Unauthorized", error: err.message });
  }
};

module.exports = verifyAgency;
