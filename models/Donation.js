const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  name: String,
  amount: Number, // Amount should be stored as a Number
  message: String,
  transactionId: String,
  createdAt: { type: Date, default: Date.now }
});

const Donation = mongoose.model('Donation', donationSchema);

module.exports = Donation;
