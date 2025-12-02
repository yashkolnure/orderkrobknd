// server.js
console.log("✅ server.js started...");
const express = require("express");
const cors = require('cors');
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const publicRoutes = require("./routes/public");
const MenuItem = require("./models/MenuItem"); // adjust the path as needed
const Order = require("./models/Order"); // ✅ Add "./"
const cron = require("node-cron");
const Restaurant = require("./models/Restaurant");
const OrderHistory = require("./models/OrderHistory"); // ✅ Add "./"
// Load environment variables
dotenv.config();
const Razorpay = require("razorpay");
const crypto = require("crypto");

cron.schedule("0 * * * *", async () => {
  const now = new Date();

  try {
    // 1. Existing: Deactivate QR Menu if time has passed
    await Restaurant.updateMany(
      { active: true, expiresAt: { $lte: now } },
      { $set: { active: false } }
    );

    // 2. 🆕 New: Deactivate Billing if time has passed
    await Restaurant.updateMany(
      { billing: true, billingExpiresAt: { $lte: now } },
      { $set: { billing: false } }
    );

    console.log("✅ Cron Job Checked: Expired QR Menus & Billing Plans processed.");
    
  } catch (error) {
    console.error("❌ Cron Job Error:", error);
  }
});

// ✅ Razorpay Instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

console.log("✅ .env loaded");

// Create express app
const app = express();


app.use(cors());

// ✅ CORS Configuration

const allowedOrigins = [
  'https://menu-two-puce.vercel.app',
  'https://menu-coral-tau.vercel.app',
  'http://localhost:3000', 
  'http://168.231.123.91', // for local development
];

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // allow all
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

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
// ... (rest of the imports and setup)
app.use("/api", publicRoutes);

app.post("/api/clearTable/:tableNumber", async (req, res) => {
  try {
    let { tableNumber } = req.params;
    tableNumber = tableNumber.trim(); 

    console.log(`Received Request to clear table: "${tableNumber}"`);

    const { 
      taxRate = 0, 
      discountRate = 0, 
      additionalCharges = 0,
      paymentMethod = 'Cash' 
    } = req.body;

    // 🧠 SMART QUERY LOGIC
    let searchCriteria = { tableNumber: tableNumber };
    const missingKeywords = ["Nhi likha hai", "null", "undefined", "N/A", "Unknown"];
    
    if (missingKeywords.includes(tableNumber)) {
        console.log("⚠️ Handling 'Ghost' Table clearing...");
        searchCriteria = {
            $or: [
                { tableNumber: tableNumber },
                { tableNumber: null },
                { tableNumber: "" },
                { tableNumber: { $exists: false } }
            ]
        };
    }

    // 2. Find ALL orders for this table (Active, Pending, Cancelled)
    const orders = await Order.find(searchCriteria).populate('items.itemId');

    if (!orders.length) {
      return res.status(404).json({ message: "No orders found for this table." });
    }

    // 3. Generate Invoice Number
    const now = new Date();
    const formatNumber = (n) => n.toString().padStart(2, '0');
    const invoiceNumber = `INV-${formatNumber(now.getDate())}${formatNumber(now.getMonth() + 1)}${now.getFullYear()}${formatNumber(now.getHours())}${formatNumber(now.getMinutes())}${formatNumber(now.getSeconds())}`;

    // 4. Consolidate Items
    let subTotal = 0;
    const allOrderItems = [];
    const restaurantId = orders[0].restaurantId || null; 

    for (const order of orders) {
      
      // 🛑 THIS IS THE FIX: Skip orders that are Cancelled or Rejected
      if (order.status === 'cancelled' || order.status === 'rejected') {
          console.log(`Skipping cancelled order ID: ${order._id}`);
          continue; // Move to next order, do not add price
      }

      for (const item of order.items) {
        const itemPrice = item.price || (item.itemId ? item.itemId.price : 0) || 0;
        const itemTotal = itemPrice * item.quantity;
        subTotal += itemTotal;

        allOrderItems.push({
          name: item.itemId ? item.itemId.name : "Unknown Item",
          quantity: item.quantity,
          price: itemPrice,
          itemId: item.itemId ? item.itemId._id : null
        });
      }
    }

    // 5. Calculate Finals
    const tRate = parseFloat(taxRate) || 0;
    const dRate = parseFloat(discountRate) || 0;
    const addCharges = parseFloat(additionalCharges) || 0;

    const taxAmount = (subTotal * tRate) / 100;
    const discountAmount = (subTotal * dRate) / 100;
    
    const finalTotalVal = subTotal + taxAmount + addCharges - discountAmount;

    // 6. Create History Record (Only if there is a valid total)
    // If all orders were cancelled, subTotal might be 0. We usually still want to clear the table.
    const newHistory = new OrderHistory({
      restaurantId,
      tableNumber: tableNumber, 
      invoiceNumber,
      orderItems: allOrderItems,
      subTotal: parseFloat(subTotal.toFixed(2)),
      taxRate: tRate,
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      discountRate: dRate,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      additionalCharges: parseFloat(addCharges.toFixed(2)),
      finalTotal: parseFloat(finalTotalVal.toFixed(2)), 
      totalAmount: parseFloat(finalTotalVal.toFixed(2)), 
      paymentMethod,
      timestamp: now
    });

    await newHistory.save();

    // 7. Delete ALL Active Orders for this table (Includes Cancelled ones)
    // This ensures even the rejected/cancelled orders are removed from the 'Active' screen
    await Order.deleteMany(searchCriteria);

    console.log(`✅ Table "${tableNumber}" cleared. Cancelled orders removed.`);

    res.json({
      success: true,
      message: `Table ${tableNumber} cleared.`,
      invoiceNumber,
      totalAmount: finalTotalVal
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