const mongoose = require("mongoose");
const OrderHistorySchema = new mongoose.Schema({
  tableNumber: { type: String },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  invoiceNumber: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  orderItems: [{
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  // --- 💰 Financial Breakdown (NEW FIELDS) ---
  subTotal: { type: Number, required: true },        // Cost of items only
  taxRate: { type: Number, default: 0 },             // e.g., 5 (%)
  taxAmount: { type: Number, default: 0 },           // e.g., 50.00
  discountRate: { type: Number, default: 0 },        // e.g., 10 (%)
  discountAmount: { type: Number, default: 0 },      // e.g., 100.00
  additionalCharges: { type: Number, default: 0 },   // e.g., 20.00 (Packing/Service)
  finalTotal: { type: Number, required: true },      // The actual amount paid
  paymentMethod: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("OrderHistory", OrderHistorySchema);
