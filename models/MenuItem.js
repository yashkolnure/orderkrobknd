// models/MenuItem.js
const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true }, // This will be a string matching the category name
  description: { type: String },
  price: { type: Number },
  image: { type: String },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" },
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
