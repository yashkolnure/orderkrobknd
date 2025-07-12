const mongoose = require("mongoose");

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },   // ✅ Fix here
  logo: { type: String },
  address: { type: String, required: true },
  contact: { type: String }, // ✅ Add this line
  proFeatures: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Restaurant", RestaurantSchema);
