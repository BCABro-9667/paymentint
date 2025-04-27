const mongoose = require("mongoose");

const supporterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  message: { type: String, default: '' },
  transactionId: { type: String, required: true, unique: true },
  imageIndex: { type: Number, required: true }, // Store the image index
  createdAt: { type: Date, default: Date.now }
});

const Supporter = mongoose.model("Supporter", supporterSchema);

module.exports = Supporter;
