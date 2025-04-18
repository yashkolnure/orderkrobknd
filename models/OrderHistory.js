const mongoose = require("mongoose");

const OrderHistorySchema = new mongoose.Schema({
  tableNumber: { type: Number, required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  invoiceNumber: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  orderItems: [{
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("OrderHistory", OrderHistorySchema);
