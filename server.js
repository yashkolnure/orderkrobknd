// server.js
console.log("✅ server.js started...");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const publicRoutes = require("./routes/public");
const MenuItem = require("./models/MenuItem"); // adjust the path as needed
const Order = require("./models/Order"); // ✅ Add "./"
const OrderHistory = require("./models/OrderHistory"); // ✅ Add "./"

// Load environment variables
dotenv.config();
console.log("✅ .env loaded");

// Create express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(5000, () => {
      console.log("🚀 Server running on port 5000");
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
  });


// Import routes
const adminRoutes = require("./routes/admin");

// Use routes
app.use("/api/admin", adminRoutes);
app.use("/api", publicRoutes);
app.post("/api/clearTable/:tableNumber", async (req, res) => {
  try {
    let { tableNumber } = req.params;
    tableNumber = Number(tableNumber);

    if (isNaN(tableNumber)) {
      return res.status(400).json({ message: "Invalid table number format" });
    }

    console.log(`🔍 Clearing Table: ${tableNumber}`);

    const orders = await Order.find({ tableNumber });

    if (!orders.length) {
      return res.status(404).json({ message: "No orders found for this table." });
    }

    // ✅ Generate custom formatted invoice number once
    const now = new Date();
    const formatNumber = (n) => n.toString().padStart(2, '0');
    const invoiceNumber = `INV-${formatNumber(now.getDate())}${formatNumber(now.getMonth() + 1)}${now.getFullYear()}${formatNumber(now.getHours())}${formatNumber(now.getMinutes())}${formatNumber(now.getSeconds())}`;

    const ordersWithHistoryData = [];

    for (const order of orders) {
      const orderObj = order.toObject();

      const populatedOrderItems = await Promise.all(
        orderObj.items.map(async (item) => {
          try {
            const itemData = await MenuItem.findById(item.itemId);
            return {
              name: itemData?.name || "Unknown Item",
              quantity: item.quantity,
              price: item.price,
            };
          } catch (err) {
            console.warn(`⚠️ Error finding MenuItem for ID ${item.itemId}:`, err);
            return {
              name: "Unknown Item",
              quantity: item.quantity,
              price: item.price,
            };
          }
        })
      );

      ordersWithHistoryData.push({
        tableNumber: order.tableNumber,
        restaurantId: order.restaurantId,
        invoiceNumber, // ✅ Same invoice number for all
        totalAmount: order.total,
        orderItems: populatedOrderItems,
        timestamp: now,
      });
    }

    await OrderHistory.insertMany(ordersWithHistoryData);
    await Order.deleteMany({ tableNumber });

    console.log("✅ Orders saved to history & deleted!");
    res.json({
      success: true,
      message: `Table ${tableNumber} cleared and orders archived.`,
      invoiceNumber
    });

  } catch (error) {
    console.error("❌ Error clearing table:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});
