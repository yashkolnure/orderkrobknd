const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema({
  name: String,
  email: String,
  passwordHash: String,
  logo: String,
  address: String,
});

module.exports = mongoose.model("Restaurant", restaurantSchema);
