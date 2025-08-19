const mongoose = require("mongoose");

const agencySchema = new mongoose.Schema({
  agencyName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  contactNumber: { type: String },
  address: { type: String },
  agencyLevel: { type: Number, default: 0 },
});

module.exports = mongoose.model("Agency", agencySchema);
