const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");  
const CustomFields = require("../models/CustomFields");
const Delivery = require("../models/Delivery");
const fs = require("fs");
const multer = require('multer');
const { verifyAdmin } = require("../middleware/verifyAdmin");
const { generateJWT } = require("../utils/generateJWT");
const auth = require("../middleware/auth");
const Redirect = require("../models/Redirect");
const Agency = require("../models/Agency");
const verifyAgency = require("../middleware/verifyAgency");
const OrderHistory = require("../models/OrderHistory");
const { route } = require("./public");
const Offer = require("../models/Offer");   
const verifySuperAdmin = require("../middleware/verifySuperAdmin");
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

router.get('/pro-features', async (req, res) => {
  try {
    const data = await Restaurant.find({}, { proFeatures: 1, _id: 0 }); // only proFeatures field
    res.json(data); // returns an array of objects: [{ proFeatures: true }, { proFeatures: false }, ...]
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Set storage options
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // folder where images will be saved
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Create upload instance
const upload = multer({ storage: storage });
// GET all restaurants
router.get("/restaurants", async (req, res) => {
  try {
    const data = await Restaurant.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch restaurants" });
  }
});


// Update order status (Accept / change status)
router.put("/:id/orders/:orderId", auth, async (req, res) => {
  // ensure the authenticated restaurant matches the requested id
  if (req.params.id !== req.restaurantId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "status is required" });

    const order = await Order.findOneAndUpdate(
      { _id: req.params.orderId, restaurantId: req.restaurantId },
      { $set: { status } },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({ success: true, order });
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});


// ADD new restaurant
router.post("/restaurants", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      address,
      logo,
      contact,
      membership_level,
      currency,
      planType = "free", // default if not provided
    } = req.body;

    // ✅ Validate required fields
    if (!name || !email || !password || !address || !logo || !contact || !membership_level || !currency) {
      return res.status(400).json({ message: "All fields including currency are required" });
    }

    // ✅ Check if email already exists
    const existing = await Restaurant.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // ✅ Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // ✅ Calculate expiry date based on planType
    const expiryDate = new Date();
    if (planType === "free") expiryDate.setDate(expiryDate.getDate() + 7);
    else if (planType === "premium") expiryDate.setMonth(expiryDate.getMonth() + 1);
    else if (planType === "pro") expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    // ✅ Create restaurant
    const restaurant = new Restaurant({
      name,
      email,
      passwordHash,
      address,
      logo,
      contact,
      membership_level,
      currency,
      planType,
      expiresAt: expiryDate,
      active: true, // Always true on registration
    });

    await restaurant.save();

    res.status(201).json({
      message: "Restaurant created successfully",
      restaurant,
    });
  } catch (err) {
    console.error("Error creating restaurant:", err);
    res.status(500).json({ message: "Error creating restaurant" });
  }
});


// Backend route example
router.get("/restaurants/check-email", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const existing = await Restaurant.findOne({ email });
    res.json({ exists: !!existing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
// UPDATE restaurant
router.put("/restaurants/:id", async (req, res) => {
  try {
    const updates = { ...req.body };

    // 🧩 Handle password hashing if provided
    if (updates.password) {
      updates.passwordHash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }

    // 🕐 Handle activation + expiration logic
    if (typeof updates.active !== "undefined") {
      if (updates.active) {
        // If being activated, set expiresAt (if provided by frontend)
        if (updates.expiresAt) {
          updates.expiresAt = new Date(updates.expiresAt);
        }
      } else {
        // If deactivating manually, clear expiry
        updates.expiresAt = null;
      }
    }

    // ✅ Update restaurant
    const updated = await Restaurant.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(updated);
  } catch (err) {
    console.error("Update failed:", err);
    res.status(500).json({ message: "Update failed" });
  }
});


// DELETE restaurant
router.delete("/restaurants/:id", async (req, res) => {
  try {
    await Restaurant.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

router.get("/:restaurantId/details", async (req, res) => {
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
router.post('/order-history', async (req, res) => {
  const { orderItems, totalAmount, tableNumber, restaurantId, invoiceNumber } = req.body;

  console.log("Received Order Data:", req.body);  // Debugging log

  try {
    // Validate incoming data
    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No items in the order' });
    }
    if (!totalAmount || !tableNumber || !restaurantId || !invoiceNumber) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // No need to fetch MenuItem data as the frontend is sending name, quantity, price directly
    const formattedOrderItems = orderItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));

    // Create a new order history entry
    const orderHistory = new OrderHistory({
      restaurantId,
      invoiceNumber,
      totalAmount,
      orderItems: formattedOrderItems,
      tableNumber,
    });

    // Save the order to the database
    await orderHistory.save();

    res.status(200).json({
      message: 'Order history saved successfully',
      orderHistory,
    });
  } catch (error) {
    console.error("Error saving order history:", error);
    res.status(500).json({ message: 'Error saving order history', error: error.message });
  }
});


// Update Menu Item
router.put("/:restaurantId/menu/:itemId", auth, async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    const updatedItem = await MenuItem.findOneAndUpdate(
      { _id: itemId, restaurantId },
      req.body,
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json(updatedItem);
  } catch (err) {
    console.error("Error updating item:", err);
    res.status(500).json({ message: "Update failed" });
  }
});


// GET all offers for a restaurant
router.get("/:restaurantId/offers", async (req, res) => {
  try {
    const offers = await Offer.find({ restaurant: req.params.restaurantId })
      .sort({ createdAt: -1 });
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST a new offer
router.post("/:restaurantId/offers", async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ message: "Image is required" });
  try {
    const newOffer = new Offer({
      restaurant: req.params.restaurantId,
      image,
    });
    await newOffer.save();
    res.status(201).json(newOffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error saving offer" });
  }
});

router.delete(
  "/:restaurantId/offers/:offerId",
  auth,
  async (req, res) => {
    try {
      const { restaurantId, offerId } = req.params;

      // Attempt to find & delete the offer that matches both IDs
      const deleted = await Offer.findOneAndDelete({
        _id: offerId,
        restaurant: restaurantId,
      });

      if (!deleted) {
        // No matching document
        return res.status(404).json({ message: "Offer not found" });
      }

      // Success
      res.json({ message: "Offer deleted successfully" });
    } catch (err) {
      console.error("Error deleting offer:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Register a new restaurant
router.post("/restaurant/register", async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      logo, 
      address, 
      contact, 
      subadmin_id, 
      membership_level, 
      currency,
      // New fields from Frontend
      expiresAt, 
      billing, 
      billingExpiresAt, 
      enableOrdering,
      paymentStatus, // Optional: if you added this to Schema
      transactionId  // Optional: if you added this to Schema
    } = req.body;

    // 1. Check if email is already registered
    const existingRestaurant = await Restaurant.findOne({ email });
    if (existingRestaurant) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Determine Expiry Date
    // Priority: Use date from Frontend (Paid/Plan logic) > Fallback to 7 Days (Trial)
    let finalExpiry;
    if (expiresAt) {
      finalExpiry = new Date(expiresAt);
    } else {
      finalExpiry = new Date();
      finalExpiry.setDate(finalExpiry.getDate() + 7); // Default 7-day trial
    }

    // 4. Build restaurant object
    const newRestaurantData = {
      name,
      email,
      passwordHash,
      logo,
      address,
      contact,
      membership_level: membership_level || 1,
      currency: currency || "INR",
      
      // --- Feature Flags & Dates ---
      expiresAt: finalExpiry,
      billing: billing || false, // Boolean from frontend
      billingExpiresAt: billingExpiresAt ? new Date(billingExpiresAt) : null,
      enableOrdering: enableOrdering || "enabled", // 'enabled' or 'disabled'
      
      // Optional: Add payment info if your Schema supports it
      // paymentStatus, 
      // transactionId
    };

    // 5. Conditionally include subadmin_id if provided
    if (subadmin_id) {
      newRestaurantData.subadmin_id = subadmin_id;
    }

    // 6. Create and save restaurant
    const newRestaurant = new Restaurant(newRestaurantData);
    await newRestaurant.save();

    res.status(201).json({
      message: "Restaurant registered successfully",
      restaurant: {
        id: newRestaurant._id,
        name: newRestaurant.name,
        email: newRestaurant.email,
        expiresAt: newRestaurant.expiresAt,
        billing: newRestaurant.billing
      },
    });

  } catch (error) {
    console.error("Error registering restaurant:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// GET all restaurants for a specific subadmin
router.get("/restaurant/all", async (req, res) => {
  try {
    const { subadmin_id } = req.query;

    if (!subadmin_id) {
      return res.status(400).json({ message: "Missing subadmin_id" });
    }

    const restaurants = await Restaurant.find({ subadmin_id });

    res.status(200).json(restaurants);
  } catch (err) {
    console.error("Error fetching restaurants:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Bulk Insert Route
router.post('/bulk', async (req, res) => {
  try {
    const menuItems = req.body;

    if (!Array.isArray(menuItems)) {
      return res.status(400).json({ message: "Invalid data format. Expected an array." });
    }

    await MenuItem.insertMany(menuItems);
    res.status(200).json({ message: "Menu items uploaded successfully!" });
  } catch (error) {
    console.error("Bulk upload error:", error);
    res.status(500).json({ message: "Server error during bulk upload" });
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
  
  router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Incoming login:", email, password);

    if (!email || !password) {
      console.log("Missing email or password");
      return res.status(400).json({ message: "Email and password are required" });
    }

    // 👇 CHANGE 1: Clean the email input
    const emailInput = email.trim(); 

    // 👇 CHANGE 2: Use Regex to find the Restaurant (Case Insensitive)
    // ^ means start, $ means end, 'i' means case-insensitive
    const restaurant = await Restaurant.findOne({ 
        email: { $regex: `^${emailInput}$`, $options: 'i' } 
    });
    
    console.log("Restaurant found:", restaurant);

    if (!restaurant) {
      console.log("Restaurant not found");
      return res.status(400).json({ message: "Restaurant not found" });
    }

    if (!restaurant.passwordHash) {
      console.log("No passwordHash found");
      return res.status(500).json({ message: "Password is missing in database" });
    }

    console.log("Comparing passwords...");
    const isMatch = await bcrypt.compare(password, restaurant.passwordHash);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("Password mismatch");
      return res.status(400).json({ message: "Incorrect password" });
    }

    console.log("Creating token...");
    const token = jwt.sign(
      { restaurantId: restaurant._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    console.log("Login successful");
    res.json({ token, restaurant });

  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/orders/:id", auth, async (req, res) => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(req.params.id);
    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: "Server error" });
  }
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

router.post("/clearTable/:tableNumber", async (req, res) => {
  const { restaurantId } = req.body;
  const tableNumber = req.params.tableNumber;
  console.log("🛠️ Clear Table Request for table:", tableNumber, "restaurant:", restaurantId);

  if (!restaurantId) {
    return res.status(400).json({ error: "restaurantId is required" });
  }

  try {
    // Delete all orders for this restaurant and table number (string match)
    await Order.deleteMany({ restaurantId, tableNumber });
    res.json({ message: `Table ${tableNumber} cleared successfully!` });
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

router.post("/register-agency", async (req, res) => {
  try {
    const { agencyName, email, password, contactNumber, address, agencyLevel } = req.body;

    console.log("📩 Register Agency Request:", req.body);

    const existing = await Agency.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Agency already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const agency = new Agency({
      agencyName,
      email,
      password: hashedPassword,
      contactNumber,
      address,
      agencyLevel, // now this is defined
    });

    await agency.save();

    console.log("✅ Agency Saved:", agency);

    res.status(201).json({ message: "Agency registered successfully" });
  } catch (err) {
    console.error("❌ Register Error:", err);
    res.status(500).json({ message: "Error registering agency", error: err.message });
  }
});

router.post("/agency-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const agency = await Agency.findOne({ email });
    if (!agency) {
      return res.status(404).json({ message: "Agency not found" });
    }

    const isMatch = await bcrypt.compare(password, agency.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ Create JWT token
    const token = jwt.sign(
      { id: agency._id, email: agency.email, agencyLevel: agency.agencyLevel },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      agency: {
        id: agency._id,
        name: agency.agencyName,
        email: agency.email,
        agencyLevel: agency.agencyLevel,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// Agency impersonates a restaurant
router.post("/agency-login-restaurant/:restaurantId", verifyAgency, async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Generate impersonation JWT (restaurant user)
const token = jwt.sign(
  {
    restaurantId: restaurant._id,
    email: restaurant.email,
    name: restaurant.name,
    role: "restaurant",
    impersonatedBy: req.user._id, // only present in impersonation flow
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

    res.status(200).json({
      message: "Impersonation login successful",
      token,
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        email: restaurant.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// ✅ Super Admin impersonates a restaurant
router.post("/superadmin-login-restaurant/:restaurantId", verifySuperAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    // Create restaurant JWT (what your dashboard expects)
    const token = generateJWT({
      id: restaurant._id,
      email: restaurant.email,
      name: restaurant.name,
      role: "restaurant",
      impersonatedBy: req.user.id,       // who triggered
      impersonatedByRole: "superadmin",  // clarity
    });

    return res.status(200).json({
      message: "Super Admin impersonation login successful",
      token,
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        email: restaurant.email,
      },
    });
  } catch (err) {
    console.error("superadmin-login-restaurant error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});



// PUT -> Upgrade Membership
router.put("/upgrade-membership/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { newLevel } = req.body;

    // check valid level
    if (![1, 2, 3].includes(newLevel)) {
      return res.status(400).json({ message: "Invalid membership level" });
    }

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // prevent downgrade or same level
    if (newLevel <= restaurant.membership_level) {
      return res
        .status(400)
        .json({ message: "Cannot downgrade or keep same level" });
    }

    // update
    restaurant.membership_level = newLevel;
    await restaurant.save();

    res.json({
      message: "Membership upgraded successfully",
      restaurant,
    });
  } catch (err) {
    console.error("Upgrade error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


router.post("/custom-fields", async (req, res) => {
  try {
    const { restaurantId, instagram, facebook, website, contact, customLine, googleReview } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    const fields = await CustomFields.findOneAndUpdate(
      { restaurantId },
      { instagram, facebook, website, contact, customLine, googleReview },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(fields);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save custom fields" });
  }
});

/**
 * Get custom fields by restaurantId
 * ?restaurantId=xxx
 */
router.get("/custom-fields", async (req, res) => {
  try {
    const { restaurantId } = req.query;
    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    const fields = await CustomFields.findOne({ restaurantId });
    if (!fields) return res.status(404).json({ message: "No fields found" });

    res.json(fields);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch custom fields" });
  }
});

router.post("/menu-extract", upload.single("file"), async (req, res) => {
  try {
    const { restaurantId } = req.body; // <--- dynamic restaurantId
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!restaurantId) return res.status(400).json({ error: "Restaurant ID is required" });

    const fileData = fs.readFileSync(req.file.path);
    const base64Data = fileData.toString("base64");

    const prompt = `
You are a professional data extractor and formatter.

I will provide you with an image of a restaurant menu. Your task is to help me extract all the menu items and convert them into valid JSON format for uploading into a database.

Here are the instructions:
1. Each menu item should be represented as a JSON object with the following fields:
- name: The name of the menu item (string)
- category: The category of the item (e.g., NON VEG STARTERS, PURE VEG, BREADS, RICE, VEG STARTERS) (string)
- description: A short descriptive line about the item (you can create it if needed) (string)
- price: The item price in numbers (use the FULL price if multiple sizes are shown; if possible, list multiple sizes as separate objects)
- image: Use "data:image/webp;base64,..." as a placeholder (string)
- restaurantId: Use "${restaurantId}" as the placeholder value (string)

2. Do not skip any items from the menu. Even if an item has multiple sizes (Full/Half/Quarter), create separate JSON objects for each variant.

3. The final output must be:
- Pure valid JSON (no explanation, no extra text)
- An array of objects inside [ ... ]
- Maintain consistency in fields for all objects.

I will now provide the menu card image. Please extract all items and return the complete JSON.
`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: req.file.mimetype } },
    ]);

    fs.unlinkSync(req.file.path);

    let json;
    try {
      json = JSON.parse(result.response.text());
    } catch {
      const match = result.response.text().match(/\[[\s\S]*\]/);
      json = match ? JSON.parse(match[0]) : { error: "Invalid JSON from AI" };
    }

    res.json(json);
  } catch (err) {
    console.error("Menu Extract Error:", err);
    res.status(500).json({ error: "Failed to process image" });
  }
});

// Add a redirect
router.post("/redirects", async (req, res) => {
  try {
    const { from, to } = req.body;
    const redirect = new Redirect({ from, to });
    await redirect.save();
    res.status(201).json({ message: "Redirect created", redirect });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all redirects (optional)
router.get("/redirects", async (req, res) => {
  const redirects = await Redirect.find();
  res.json(redirects);
});

// Get restaurants with more than 10 menu items (return id, name, logo, address)
router.get("/restaurants-with-many-menus", async (req, res) => {
  try {
    // Step 1: Aggregate menu items to find restaurant IDs with >10 items
    const aggregation = await MenuItem.aggregate([
      {
        $group: {
          _id: "$restaurantId",
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 10 }
        }
      },
      {
        $project: { _id: 1 }
      }
    ]);

    const restaurantIds = aggregation.map(r => r._id);

    // Step 2: Fetch restaurant details
    const restaurants = await Restaurant.find(
      { _id: { $in: restaurantIds } },
      { name: 1, logo: 1, address: 1, contact: 1 } // only select required fields
    ).lean();

    res.json({ success: true, restaurants });
  } catch (err) {
    console.error("Error fetching restaurants:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// PUT /api/admin/:id/status
router.put('/:id/status',  async (req, res) => {
  try {
    const { isLive } = req.body;
    await Restaurant.findByIdAndUpdate(req.params.id, { isLive });
    res.status(200).json({ success: true, isLive });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// GET /api/orders/table/:restaurantId/:tableNumber
router.get('/orders/table/:restaurantId/:tableNumber', async (req, res) => {
  try {
    const { restaurantId, tableNumber } = req.params;

    // 1. Calculate Start of Today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 2. Find orders and Populate using 'items.itemId'
    const orders = await Order.find({
      restaurantId: restaurantId,
      tableNumber: tableNumber,
      createdAt: { $gte: startOfDay } 
    })
    .sort({ createdAt: -1 })
    // ▼ THIS IS THE FIX ▼
    .populate('items.itemId', 'name price description type'); 

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error fetching table orders" });
  }
});


// This handles updates for orderMode, billing, isLive, etc.
router.put('/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body; // Contains { orderMode: 'billing' } etc.

    // 1. Find and Update
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true } // Return the updated document
    );

    if (!updatedRestaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json({ success: true, restaurant: updatedRestaurant });
  } catch (error) {
    console.error("Settings update error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});


// --- 1. REQUEST OTP ---
router.post('/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await Restaurant.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email not found" });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save to DB (Expires in 10 mins)
    user.resetOtp = otp;
    user.resetOtpExpires = Date.now() + 600000; 
    await user.save();

    // Call WordPress Endpoint
    // ⚠️ REPLACE with your actual WP URL
    await axios.post('https://petoba.avenirya.com/wp-json/petoba/v1/send-otp', {
      email: user.email,
      otp: otp
    });

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error sending OTP" });
  }
});

// --- 2. VERIFY OTP ---
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await Restaurant.findOne({ 
      email, 
      resetOtp: otp, 
      resetOtpExpires: { $gt: Date.now() } 
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });

    // OTP is correct. Generate a temporary token to allow password change
    const tempToken = require('crypto').randomBytes(16).toString('hex');
    user.tempResetToken = tempToken;
    user.resetOtp = undefined; // Clear OTP so it can't be reused
    user.resetOtpExpires = undefined;
    await user.save();

    res.json({ message: "OTP Verified", tempToken });
  } catch (err) {
    res.status(500).json({ message: "Verification failed" });
  }
});

// --- 3. RESET PASSWORD ---
router.post('/reset-password-final', async (req, res) => {
  try {
    const { email, tempToken, newPassword } = req.body;
    
    console.log("👉 Attempting reset for:", email); // Debug Log

    // 1. Find the user first
    const user = await Restaurant.findOne({ email });

    if (!user) {
        console.log("❌ User not found");
        return res.status(404).json({ message: "User not found" });
    }

    // 2. Verify the token manually (Safer debugging)
    if (user.tempResetToken !== tempToken) {
        console.log("❌ Token mismatch. DB:", user.tempResetToken, "Received:", tempToken);
        return res.status(400).json({ message: "Invalid or expired session. Please verify OTP again." });
    }

    // 3. Hash the new password (IMPORTANT)
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    // 4. Clear the temporary token
    user.tempResetToken = undefined;
    user.resetOtp = undefined;
    
    await user.save();
    console.log("✅ Password updated successfully");

    res.json({ message: "Password updated successfully" });

  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).json({ message: "Server error updating password" });
  }
});

// POST /api/delivery/create
router.post("/delivery/create", async (req, res) => {
  try {
    const { restaurantId, customer, items, totalAmount } = req.body;

    // Validation
    if (!restaurantId || !customer || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Create the Delivery Record
    const newDelivery = new Delivery({
      restaurantId,
      customer,
      items,
      totalAmount,
      status: "Pending", // Default status
    });

    const savedDelivery = await newDelivery.save();

    res.status(201).json({ 
      success: true, 
      message: "Delivery order saved successfully", 
      data: savedDelivery 
    });

  } catch (error) {
    console.error("Error saving delivery:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
});

// 1. GET: Fetch all delivery orders for a restaurant (Newest first)
router.get("/delivery/all/:restaurantId", async (req, res) => {
  try {
    const orders = await Delivery.find({ restaurantId: req.params.restaurantId })
      .sort({ createdAt: -1 }); // Newest on top
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders" });
  }
});

// 2. PUT: Update Order Status
router.put("/delivery/status/:orderId", async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Delivery.findByIdAndUpdate(
      req.params.orderId,
      { status: status },
      { new: true } // Return the updated document
    );
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ message: "Error updating status" });
  }
});

router.put("/bill/:orderId", async (req, res) => {
  try {
    const { tax, deliveryCharge, discount, totalAmount } = req.body;
    
    const order = await Delivery.findByIdAndUpdate(
      req.params.orderId,
      { 
        tax, 
        deliveryCharge, 
        discount, 
        totalAmount 
      },
      { new: true }
    );
    
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ message: "Error updating bill" });
  }
});

// GET: Track All Orders by Phone Number
router.get("/delivery/track/:restaurantId/:phone", async (req, res) => {
  try {
    const { restaurantId, phone } = req.params;

    // ✅ Changed findOne -> find to get ALL orders
    const orders = await Delivery.find({
      restaurantId: restaurantId,
      "customer.phone": phone,
    }).sort({ createdAt: -1 }); // Newest first

    if (!orders || orders.length === 0) {
      return res.status(404).json({ success: false, message: "No orders found" });
    }

    // ✅ Return 'orders' array
    res.json({ success: true, orders }); 
  } catch (error) {
    console.error("Tracking Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

let CACHED_MEDIA = null;
let CACHE_TIMESTAMP = 0;
const CACHE_DURATION = 3600 * 1000; // 1 Hour

// ==========================================
// 2. SMART RELEVANCE LOGIC
// ==========================================

// A. Clean up the text (Remove extensions, dimensions, dates)
const cleanText = (text) => {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/\.[^/.]+$/, "") // Remove .jpg, .png extension
    .replace(/(\d{3,4})x(\d{3,4})/g, "") // Remove dimensions like 150x150 or 1024x768
    .replace(/img_|dsc_|wp-|screenshot/g, "") // Remove common camera/WP prefixes
    .replace(/[-_]/g, " ") // Replace dashes/underscores with spaces
    .replace(/[^a-z0-9 ]/g, "") // Remove special chars
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
};

// B. Remove "Stop Words" (Words that don't add meaning)
const removeStopWords = (text) => {
  const stopWords = ["the", "a", "an", "with", "in", "on", "of", "and", "crispy", "hot", "spicy", "special", "plate", "bowl", "full", "half"];
  return text.split(" ").filter(w => !stopWords.includes(w)).join(" ");
};

// C. The Brain: Compare Dish Name vs Image Filename
const getSmartScore = (dishName, imageName) => {
  // 1. Clean both strings
  const cleanDish = removeStopWords(cleanText(dishName));
  const cleanImg = removeStopWords(cleanText(imageName));

  if (!cleanDish || !cleanImg) return 0;

  // 2. Direct Substring Bonus (e.g. Dish: "Paneer Tikka", Img: "Paneer Tikka Masala")
  if (cleanImg.includes(cleanDish)) return 1.0; // Perfect match

  // 3. Token Matching (Dice Coefficient)
  const dishTokens = cleanDish.split(" ");
  const imgTokens = cleanImg.split(" ");
  
  // Count matches
  let matches = 0;
  dishTokens.forEach(token => {
    if (imgTokens.includes(token)) matches++;
  });

  // Calculate score: (2 * matches) / (total words)
  return (2.0 * matches) / (dishTokens.length + imgTokens.length);
};

// ==========================================
// 3. PARALLEL FETCHING ENGINE
// ==========================================
const fetchWPImagesParallel = async () => {
    const wpUrl = "https://website.avenirya.com/wp-json/wp/v2/media";
    const username = "admin";
    const password = "udnR gl7q 5wds 6LzC P8iO 3F1X"; // ⚠️ Use env variables
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    let allMedia = [];
    const perPage = 100;
    const totalPagesToScan = 100; // 100 pages * 100 items = 10,000 items
    
    // Create an array of page numbers: [1, 2, 3 ... 100]
    const pages = Array.from({ length: totalPagesToScan }, (_, i) => i + 1);
    
    // We will fetch 5 pages at a time (Concurrency Limit) to avoid Timeouts
    const chunkSize = 5; 
    
    console.log(`🚀 Starting Parallel Download of ${totalPagesToScan * perPage} images...`);

    for (let i = 0; i < pages.length; i += chunkSize) {
        const chunk = pages.slice(i, i + chunkSize);
        
        // Execute 5 requests simultaneously
        const promises = chunk.map(page => 
            axios.get(wpUrl, {
                params: { per_page: perPage, page: page, _fields: "title,source_url" },
                headers: { Authorization: `Basic ${auth}` },
                timeout: 10000 // 10s timeout per request
            }).catch(err => null) // Return null on error so Promise.all doesn't fail
        );

        const results = await Promise.all(promises);

        results.forEach(res => {
            if (res && res.data) {
                const simplified = res.data.map(m => ({
                    title: m.title.rendered, // Keep original title for processing later
                    url: m.source_url
                }));
                allMedia.push(...simplified);
            }
        });

        // Optional: Log progress
        console.log(`...downloaded batch ${i / chunkSize + 1} (${allMedia.length} images so far)`);
    }

    return allMedia;
};

// ==========================================
// ROUTE: GET SUGGESTIONS
// ==========================================
router.post("/:restaurantId/get-ai-suggestions", async (req, res) => {
  req.setTimeout(600000); // Increase timeout to 10 minutes for the heavy lift

  try {
    const { restaurantId } = req.params;
    
    // 1. Fetch Missing Items
    const allItems = await MenuItem.find({ restaurantId });
    const targetItems = allItems.filter(item => {
        if (!item.image) return true;
        if (item.image.trim() === "") return true;
        if (item.image.length < 15) return true; 
        return false;
    });

    if (targetItems.length === 0) {
        return res.json({ success: true, suggestions: {}, candidates: {}, message: "All items have images." });
    }

    console.log(`🔍 Need images for ${targetItems.length} items.`);

    // 2. Fetch Media (Check Cache or Download)
    let allMedia = [];
    
    if (CACHED_MEDIA && (Date.now() - CACHE_TIMESTAMP < CACHE_DURATION)) {
        console.log("⚡ Using Cached Media Library");
        allMedia = CACHED_MEDIA;
    } else {
        allMedia = await fetchWPImagesParallel();
        
        if (allMedia.length > 0) {
            CACHED_MEDIA = allMedia;
            CACHE_TIMESTAMP = Date.now();
            console.log(`✅ Cached ${allMedia.length} images.`);
        }
    }

    // 3. Match Logic
    const suggestions = {}; 
    const candidates = {};
    let foundCount = 0;
    
    for (const item of targetItems) {
      const searchString = `${item.name} ${item.category}`;
      let itemMatches = [];

      for (const media of allMedia) {
        if(!media.title) continue;
        
        // Use the new Smart Score function
        const score = getSmartScore(searchString, media.title);
        
        // Threshold: 0.35 (Flexible matching due to better cleaning)
        if (score > 0.35) {
          itemMatches.push({ url: media.url, score });
        }
      }

      // Sort by score
      itemMatches.sort((a, b) => b.score - a.score);
      
      // Top 6 matches
      const topMatches = itemMatches.slice(0, 6).map(m => m.url);

      if (topMatches.length > 0) {
        suggestions[item._id] = topMatches[0];
        candidates[item._id] = topMatches;
        foundCount++;
      }
    }

    res.json({ 
        success: true, 
        suggestions, 
        candidates,
        message: `Scanned ${allMedia.length} images. Matched ${foundCount} items.`
    });

  } catch (error) {
    console.error("Match Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});
// ==========================================
// ROUTE 2: BULK UPDATE (COMMIT CHANGES)
// ==========================================
router.put("/:restaurantId/bulk-update-images", async (req, res) => {
  try {
    const { updates } = req.body; // { itemId: "url", itemId2: "url" }
    
    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
    }

    const bulkOps = Object.entries(updates).map(([id, url]) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { image: url } }
      }
    }));

    await MenuItem.bulkWrite(bulkOps);

    res.json({ success: true, message: "Database updated successfully" });
  } catch (error) {
    console.error("Bulk Save Error:", error);
    res.status(500).json({ message: "Error saving images" });
  }
});


module.exports = router;
