const mongoose = require("mongoose");

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },   // ✅ Fix here
  logo: { type: String },
  address: { type: String, required: true },
  proFeatures: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Restaurant", RestaurantSchema);
