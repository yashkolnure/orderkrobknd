// routes/menuItemRoutes.js
const express = require("express");
const router = express.Router();
const MenuItem = require("../models/MenuItem");

// Bulk insert route
router.post("/menu-items/bulk", async (req, res) => {
  try {
    const items = req.body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid or empty data array" });
    }

    const result = await MenuItem.insertMany(items);
    res.status(200).json({ message: "Menu items inserted successfully", insertedCount: result.length });
  } catch (error) {
    console.error("Bulk insert error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
