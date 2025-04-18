const express = require("express");
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem"); // Import MenuItem model to get prices

const router = express.Router();
const axios = require("axios");

// Place an order
router.post("/order", async (req, res) => {
  try {
    console.log("📥 Incoming order:", req.body); // <-- Log the incoming order for debugging

    // Extract table number and other data from the request body
    const { restaurantId, tableNumber, items, total } = req.body;

    // Validate the order data
    if (!restaurantId || !tableNumber || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    // Fetch prices from the MenuItem collection and add them to the order
    const updatedItems = await Promise.all(
      items.map(async (item) => {
        // Fetch the menu item details using the itemId
        const menuItem = await MenuItem.findById(item.itemId);

        if (!menuItem) {
          throw new Error(`Menu item with id ${item.itemId} not found`);
        }

        // Add the price to the item
        return {
          itemId: item.itemId,
          quantity: item.quantity,
          price: menuItem.price,  // Attach the price from the menu item
        };
      })
    );

    // Create the order with updated items including price
    const order = new Order({
      restaurantId,
      tableNumber,  // Include table number in the order
      items: updatedItems,
      total,
      status: "pending",
      createdAt: new Date(),
    });

    // Save the order to the database
    await order.save();
    
// Assuming order object is already saved and you have access to tableNumber, items, total
try {
  await axios.post("http://localhost:5001/print-order", {
    tableNumber: order.tableNumber,
    items: order.items,
    total: order.totalAmount,
  });
  console.log("🖨️ Order sent to printer");
} catch (err) {
}

    // Respond with success
    res.status(201).json({ message: "Order placed", order });
  } catch (err) {
    console.error("❌ Order error:", err.message);
    res.status(500).json({ message: "Order failed", error: err.message });
  }
});

module.exports = router;
