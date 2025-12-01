const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant", 
      required: true,
    },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      landmark: { type: String },
      pincode: { type: String },
    },
    items: [
      {
        itemId: { type: String },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Out for Delivery", "Delivered", "Cancelled"],
      default: "Pending",
    },
    
  },
  { timestamps: true }
);

// This creates a collection named 'deliveries' in your database
module.exports = mongoose.model("Delivery", deliverySchema);