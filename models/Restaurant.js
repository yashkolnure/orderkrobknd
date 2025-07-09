const mongoose = require("mongoose");

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  logo: { type: String },
  address: { type: String, required: true },
  proFeatures: { type: Boolean, default: false }, // ✅ Add this line
}, { timestamps: true });

module.exports = mongoose.model("Restaurant", RestaurantSchema);
