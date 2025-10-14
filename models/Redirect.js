const mongoose = require("mongoose");

const redirectSchema = new mongoose.Schema({
  from: { type: String, required: true, unique: true }, // e.g., /old-page
  to: { type: String, required: true },                 // e.g., /new-page
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Redirect", redirectSchema);
