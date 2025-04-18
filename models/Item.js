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
});

module.exports = mongoose.model("Item", ItemSchema);
