const mongoose = require("mongoose");

const CustomFieldsSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    unique: true, // only 1 record per restaurant
  },
  instagram: { type: String, default: "" },
  facebook: { type: String, default: "" },
  website: { type: String, default: "" },
  contact: { type: String, default: "" },
  customLine: { type: String, default: "" },
  googleReview: { type: String, default: "" },
});

module.exports = mongoose.model("CustomFields", CustomFieldsSchema);
