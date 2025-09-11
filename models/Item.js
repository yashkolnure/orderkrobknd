const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  category: {
    type: String, // e.g. "Starters", "Main Course", "Desserts"
    default: "General",
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  imageUrl: {
    type: String, // optional image
  },
  
  inStock: { type: Boolean, default: true } // ✅ NEW FIELD
});

module.exports = mongoose.model("Item", ItemSchema);
