// import jwt from "jsonwebtoken";
// import User from "../models/Restaurant.js"; // if agencies are stored here, otherwise Agency model

// export const verifyAdmin = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader) return res.status(401).json({ message: "No token provided" });

//     const token = authHeader.split(" ")[1];
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // Accept agency/admin type
//     if (decoded.type !== "agency" && decoded.role !== "admin") {
//       return res.status(403).json({ message: "Access denied" });
//     }

//     req.user = decoded; // no need to fetch DB if JWT already has info
//     next();
//   } catch (err) {
//     return res.status(401).json({ message: "Invalid or expired token" });
//   }
// };
