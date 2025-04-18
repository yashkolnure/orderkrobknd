const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");  // Order model import
const auth = require("../middleware/auth");
const OrderHistory = require("../models/OrderHistory");
const { route } = require("./public");

const router = express.Router();

// Static predefined categories
const categories = ["Pizza", "Main Course", "Desserts", "Beverages"];

router.get("/:restaurantId/details", auth, async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    res.json(restaurant);
  } catch (error) {
    console.error("Error fetching restaurant details:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// Register a new restaurant
router.post("/restaurant/register", async (req, res) => {
  try {
      const { name, email, password, logo, address } = req.body;

      // Check if email is already registered
      const existingRestaurant = await Restaurant.findOne({ email });
      if (existingRestaurant) {
          return res.status(400).json({ message: "Email already in use" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create new restaurant entry
      const newRestaurant = new Restaurant({
          name,
          email,
          passwordHash,
          logo,
          address,
      });

      await newRestaurant.save();

      res.status(201).json({ message: "Restaurant registered successfully", restaurant: newRestaurant });
  } catch (error) {
      console.error("Error registering restaurant:", error);
      res.status(500).json({ message: "Server error" });
  }
});


// Route to fetch all categories (static list)
router.get("/:restaurantId/categories", (req, res) => {
    res.json(categories); // Return static categories list
  });
  
  // Route to add a new menu item
  router.post("/:restaurantId/menu", async (req, res) => {
    const { name, category, description, price, image } = req.body;
  
    const newMenuItem = new MenuItem({
      name,
      category,
      description,
      price,
      image,
      restaurantId: req.params.restaurantId,
    });
  
    await newMenuItem.save();
    res.status(201).json(newMenuItem); // Return the newly added menu item
  });
  

  router.get("/billing", async (req, res) => {
    try {
      const billingData = await Billing.find().populate("restaurant"); // Ensure restaurant details are populated
      res.json(billingData);
    } catch (error) {
      console.error("Billing Fetch Error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });


  // Route to fetch menu items for the restaurant
  router.get("/:restaurantId/menu", async (req, res) => {
    try {
      const menuItems = await MenuItem.find({ restaurantId: req.params.restaurantId });
      res.json(menuItems); // Return all menu items for the restaurant
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });

// Admin Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const restaurant = await Restaurant.findOne({ email });
  if (!restaurant) return res.status(400).json({ message: "Restaurant not found" });

  const isMatch = await bcrypt.compare(password, restaurant.passwordHash);
  if (!isMatch) return res.status(400).json({ message: "Incorrect password" });

  const token = jwt.sign({ restaurantId: restaurant._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({ token, restaurant });
});

router.get("/:id/menu", auth, async (req, res) => {
    if (req.params.id !== req.restaurantId)
      return res.status(403).json({ message: "Forbidden" });
  
    const items = await MenuItem.find({ restaurantId: req.restaurantId });
    res.json(items);
  });
  
// Add Menu Item for Restaurant
router.post("/:id/menu", auth, async (req, res) => {
  if (req.params.id !== req.restaurantId)
    return res.status(403).json({ message: "Forbidden" });

  try {
    const newItem = new MenuItem({ ...req.body, restaurantId: req.restaurantId });
    await newItem.save();
    res.status(201).json(newItem);  // Return the newly added item
  } catch (err) {
    console.error("Error adding menu item:", err);
    res.status(500).json({ message: "Error adding menu item" });
  }
});

// Delete Menu Item
router.delete("/:id/menu/:itemId", auth, async (req, res) => {
  if (req.params.id !== req.restaurantId)
    return res.status(403).json({ message: "Forbidden" });

  try {
    await MenuItem.findOneAndDelete({ _id: req.params.itemId, restaurantId: req.restaurantId });
    res.json({ message: "Item deleted" });
  } catch (err) {
    console.error("Error deleting menu item:", err);
    res.status(500).json({ message: "Error deleting menu item" });
  }
});

// Get Orders for Admin Restaurant
router.get("/:id/orders", auth, async (req, res) => {
  if (req.params.id !== req.restaurantId)
    return res.status(403).json({ message: "Forbidden" });

  try {
    const orders = await Order.find({ restaurantId: req.restaurantId }).populate("items.itemId");
    res.json(orders);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ message: "Failed to fetch orders", error: err.message });
  }
});

// ✅ API to Clear Table and Save Orders to History

// ✅ Correct API Route
router.post("/clearTable/:tableNumber", async (req, res) => {
  try {
    console.log("🛠️ Clearing table:", req.params.tableNumber);
    res.json({ message: `Table ${req.params.tableNumber} cleared successfully!` });
  } catch (error) {
    console.error("❌ Error clearing table:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/:restaurantId/order-history", auth, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // ✅ Validate restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID format" });
    }

    const objectId = new mongoose.Types.ObjectId(restaurantId);
    const orders = await OrderHistory.find({ restaurantId: objectId }).sort({ timestamp: -1 });

    // Optional: Some prefer returning 200 with empty array instead of 404
    if (orders.length === 0) {
      return res.status(200).json([]); // or keep 404 if that's your design
    }

    res.status(200).json(orders); // ✅ Always return JSON
  } catch (err) {
    console.error("❌ Error fetching order history:", err);

    // Optional: return error as JSON too
    res.status(500).json({ message: "Error fetching order history", error: err.message });
  }
});


module.exports = router;
