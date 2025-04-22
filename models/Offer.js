// models/Offer.js
const mongoose = require("mongoose");

const OfferSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  image: {
    type: String,       // base64 or URL after upload to CDN
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Offer", OfferSchema);
