const express = require("express");
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const router = express.Router();
const axios = require("axios"); // Used for both Printer & Notifications

// ... imports
router.post("/order", async (req, res) => {
  try {
    console.log("📥 Incoming order:", req.body);

    const { restaurantId, tableNumber, wpno, items, total } = req.body;

    // 1. Validate
    if (!restaurantId || !tableNumber || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    // 2. Fetch prices (Keep your existing logic)
    const updatedItems = await Promise.all(
      items.map(async (item) => {
        const menuItem = await MenuItem.findById(item.itemId);
        if (!menuItem) throw new Error(`Menu item ${item.itemId} not found`);
        return { itemId: item.itemId, quantity: item.quantity, price: menuItem.price };
      })
    );

    // 3. Save Order
    const order = new Order({
      restaurantId,
      tableNumber,
      items: updatedItems,
      wpno,
      total,
      status: "pending",
      createdAt: new Date(),
    });
    await order.save();

    // ============================================================
    // ✅ FIXED NOTIFICATION LOGIC (No Emojis in Headers)
    // ============================================================
    try {
      const topic = `subscribe/petoba_${restaurantId}`;
      
      // We send a JSON Object. Ntfy automatically handles emojis here.
      await axios.post(`https://ntfy.sh/`, {
        topic: topic,
        message: `Table ${tableNumber} - ₹${total}`,
        title: '🔥 New Petoba Order', // Emoji works here (in body)
        priority: 4, // 4 = High Priority
        tags: ['bell', 'moneybag'],
        click: `https://petoba.in/admin/dashboard`,
        actions: [{ 
            action: 'view', 
            label: 'Open Dashboard', 
            url: `https://petoba.in/admin/dashboard` 
        }]
      });
      console.log(`🔔 Notification sent to topic: ${topic}`);

    } catch (notifyErr) {
      console.error("❌ Notification failed:", notifyErr.message);
      // We do not stop the response if notification fails
    }

    // Optional: Printer Logic (Keep existing)
    try {
      await axios.post("http://localhost:5001/print-order", {
        tableNumber: order.tableNumber,
        items: order.items,
        total: order.total,
      });
      console.log("🖨️ Order sent to printer");
    } catch (err) {
      console.log("Printer error (ignoring):", err.message);
    }

    // 4. Success Response
    res.status(201).json({ message: "Order placed", order });

  } catch (err) {
    console.error("❌ Order error:", err.message);
    res.status(500).json({ message: "Order failed", error: err.message });
  }
});
// Delete an order by ID (Moved outside the POST route)
router.delete("/order/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting order:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;