const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const axios = require("axios");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const Donation = require('./models/Donation')
require("dotenv").config();


// Models
const Supporter = require("./models/Supporter"); // Import the Supporter model

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));

// Environment Variables
const salt_key = process.env.SALT_KEY;
const merchant_id = process.env.MERCHANT_ID;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.log('MongoDB connection error:', err));

// Test API
app.get("/", (req, res) => {
    res.send("Server is running");
});


// Create Order API
app.post("/order", async (req, res) => {
    try {
        console.log("Incoming Payment Request: ", req.body);
        const { transactionId, MUID, name, amount, number, message } = req.body;

        // Assign an image index to the supporter based on existing records
        const totalSupporters = await Supporter.countDocuments(); // Get the total number of supporters
        const imageIndex = totalSupporters % 10; // Cycle through 10 images

        // Save transaction details to MongoDB with imageIndex
        const supporter = new Supporter({
            name,
            amount,
            message,
            transactionId,
            imageIndex // Save the assigned image index
        });

        await supporter.save(); // Save supporter to the database

        const data = {
            merchantId: merchant_id,
            merchantTransactionId: transactionId,
            merchantUserId: MUID,
            name: name,
            amount: amount * 100, // convert to paise
            redirectUrl: `https://get-me-a-chai-avdhesh-kumarr.netlify.app/status/?id=${transactionId}`, // <-- Redirect to backend first
            redirectMode: 'POST',
            mobileNumber: number,
            paymentInstrument: {
                type: 'PAY_PAGE'
            }
        };

        const payload = JSON.stringify(data);
        const payloadMain = Buffer.from(payload).toString('base64');
        const keyIndex = 1;
        const string = payloadMain + '/pg/v1/pay' + salt_key;
        const sha256 = crypto.createHash('sha256').update(string).digest('hex');
        const checksum = sha256 + '###' + keyIndex;

        const prod_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay";

        const options = {
            method: 'POST',
            url: prod_URL,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            },
            data: { request: payloadMain }
        };

        const response = await axios.request(options);
        res.json(response.data);

    } catch (error) {
        console.error(error);
        res.status(500).send({ message: error.message, success: false });
    }
});

// Status API (after payment)
app.post("/status", async (req, res) => {
    try {
        const merchantTransactionId = req.query.id;
        const keyIndex = 1;
        const string = `/pg/v1/status/${merchant_id}/${merchantTransactionId}` + salt_key;
        const sha256 = crypto.createHash('sha256').update(string).digest('hex');
        const checksum = sha256 + "###" + keyIndex;

        const options = {
            method: 'GET',
            url: `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchant_id}/${merchantTransactionId}`,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': merchant_id
            }
        };

        const response = await axios.request(options);

        const baseRedirectUrl = "https://get-me-a-chai-avdhesh-kumarr.netlify.app/"; // React App
        const supporter = await Supporter.findOne({ transactionId: merchantTransactionId });

        if (response.data.success && supporter) {
            res.redirect(`${baseRedirectUrl}/?name=${encodeURIComponent(supporter.name)}&amount=${supporter.amount}&message=${encodeURIComponent(supporter.message || '')}&imageIndex=${supporter.imageIndex}`);
        } else {
            res.redirect(`${baseRedirectUrl}/failure`);
        }

    } catch (error) {
        console.error(error);
        res.redirect('http://localhost:5173/failure');
    }
});

// Fetch Top Supporters API
app.get("/top-supporters", async (req, res) => {
    try {
        // Fetch top 10 supporters from MongoDB, sorted by creation date
        const supporters = await Supporter.find().sort({ createdAt: -1 }).limit(10);
        res.json(supporters);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: error.message, success: false });
    }
});

// Endpoint to fetch the total amount raised
app.get('/total-amount', async (req, res) => {
    try {
      // Sum the 'amount' field from all donation documents
      const totalAmount = await Donation.aggregate([
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
      ]);
  
      // Check if the result is not empty and return the total amount
      if (totalAmount.length > 0) {
        res.json({ totalAmount: totalAmount[0].totalAmount });
      } else {
        res.json({ totalAmount: 0 });
      }
    } catch (error) {
      console.error('Error calculating total amount:', error);
      res.status(500).send({ message: 'Error fetching total amount' });
    }
  });

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
