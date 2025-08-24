// middleware/verifySuperAdmin.js
const jwt = require("jsonwebtoken");

module.exports = function verifySuperAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;

  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    if (decoded.role !== "superadmin") {
      return res.status(403).json({ message: "Access denied. Super Admin only." });
    }
    req.user = decoded; // { id, role, ... }
    next();
  });
};
