const mongoose = require("mongoose");

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  logo: { type: String },
  address: { type: String, required: true },
  contact: { type: String },
  proFeatures: { type: Boolean, default: false },

  // ✅ Add this line for subadmin support
  subadmin_id: { type: String }, // optionally: required: true if every restaurant must have one

}, { timestamps: true });

module.exports = mongoose.model("Restaurant", RestaurantSchema);
