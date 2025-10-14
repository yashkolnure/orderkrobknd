const mongoose = require("mongoose");

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  logo: { type: String },
  address: { type: String, required: true },
  contact: { type: String },
  membership_level: { type: Number, default: 1 }, 
  subadmin_id: { type: String }, 
  homeImage: { type: String },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Restaurant", RestaurantSchema);
