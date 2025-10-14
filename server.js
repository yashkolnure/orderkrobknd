// server.js
console.log("✅ server.js started...");
const express = require("express");
const cors = require('cors');
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const publicRoutes = require("./routes/public");
const MenuItem = require("./models/MenuItem"); // adjust the path as needed
const Order = require("./models/Order"); // ✅ Add "./"
const OrderHistory = require("./models/OrderHistory"); // ✅ Add "./"
// Load environment variables
dotenv.config();
const Razorpay = require("razorpay");
const crypto = require("crypto");

// ✅ Razorpay Instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

console.log("✅ .env loaded");

// Create express app
const app = express();




// ✅ CORS Configuration
const allowedOrigins = [
  'https://menu-two-puce.vercel.app',
  'https://menu-coral-tau.vercel.app',
  'http://localhost:3000', 
  'http://168.231.123.91', // for local development
];


app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("❌ CORS not allowed from this origin: " + origin));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

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
    const { tableNumber } = req.params; // keep as string
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

// ✅ Route to create Razorpay order
app.post("/api/create-order", async (req, res) => {
  try {
    const { amount } = req.body; // frontend sends in rupees
    const options = {
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("❌ Razorpay error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});


// ✅ Verify Razorpay payment
app.post("/api/verify-payment", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      console.log("✅ Payment verified:", razorpay_payment_id);
      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      console.log("❌ Payment verification failed");
      res.status(400).json({ success: false, message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("❌ Error verifying payment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

const menuItemRoutes = require("./routes/Menuroutesbulk"); // ✅ Adjust the path as needed
app.use("/api", menuItemRoutes);