// routes/agencyFeatures.js
import express from "express";
import agencyAuth from "../middlewares/agencyAuth.js";

const router = express.Router();

router.get("/dashboard", agencyAuth(0), (req, res) => {
  res.json({ message: `Welcome Agency ID ${req.agencyId} with Level ${req.agencyLevel}` });
});

router.get("/premium", agencyAuth(3), (req, res) => {
  res.json({ message: "Only Level 3+ agencies can access this" });
});

export default router;
