// middlewares/agencyAuth.js
import jwt from "jsonwebtoken";

const agencyAuth = (minLevel = 0) => {
  return (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ message: "Invalid token" });
      if (decoded.type !== "agency") return res.status(403).json({ message: "Not an agency account" });

      if (decoded.level < minLevel) {
        return res.status(403).json({ message: "Access denied: insufficient agency level" });
      }

      req.agencyId = decoded.id;
      req.agencyLevel = decoded.level;
      next();
    });
  };
};

export default agencyAuth;
