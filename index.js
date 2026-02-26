const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

const CASHFREE_SECRET = process.env.CASHFREE_SECRET;
const GHL_API_KEY = process.env.GHL_API_KEY;

app.post('/webhook', async (req, res) => {

  const signature = req.headers['x-webhook-signature'];
  const rawBody = JSON.stringify(req.body);

  const generatedSignature = crypto
    .createHmac('sha256', CASHFREE_SECRET)
    .update(rawBody)
    .digest('base64');

  if (generatedSignature !== signature) {
    return res.status(401).send("Invalid signature");
  }

  const data = req.body;

  if (data.payment_status !== "SUCCESS") {
    return res.status(200).send("Ignored");
  }

  const email = data.customer_details.customer_email;
  const phone = data.customer_details.customer_phone;
  const amount = data.order_amount;

  const businessType =
    data.order_meta?.["Which of these applies to you"] || "";

  const rawOrderData = JSON.stringify(data);

  try {
    await axios.post(
      "https://services.leadconnectorhq.com/contacts/",
      {
        email: email,
        phone: phone,
        tags: ["cashfree_payment_success"],
        customFields: {
          business_type: businessType,
          order_amount: amount,
          raw_order_data: rawOrderData
        }
      },
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          "Content-Type": "application/json",
          Version: "2021-07-28"
        }
      }
    );

    res.status(200).send("OK");

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error updating GHL");
  }
});

app.listen(10000, () => console.log("Server running"));
