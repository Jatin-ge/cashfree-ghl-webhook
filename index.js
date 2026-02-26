const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

// Health check (for browser test)
app.get('/webhook', (req, res) => {
  res.status(200).send("Webhook endpoint live");
});

app.post('/webhook', async (req, res) => {

  const signature = req.headers['x-webhook-signature'];
  const rawBody = JSON.stringify(req.body);

  // If no secret or no signature (Cashfree test call), accept safely
  if (!process.env.CASHFREE_SECRET || !signature) {
    return res.status(200).send("Test webhook accepted");
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', process.env.CASHFREE_SECRET)
      .update(rawBody)
      .digest('base64');

    if (generatedSignature !== signature) {
      return res.status(401).send("Invalid signature");
    }
  } catch (error) {
    return res.status(200).send("Signature check skipped (test mode)");
  }

  const data = req.body;

  // If not a real payment success event, exit safely
  if (!data.payment_status || data.payment_status !== "SUCCESS") {
    return res.status(200).send("Non-payment event received");
  }

  const email = data.customer_details?.customer_email || "";
  const phone = data.customer_details?.customer_phone || "";
  const amount = data.order_amount || "";

  const businessType =
    data.order_meta?.["Which of these applies to you"] || "";

  try {
    await axios.post(
      "https://services.leadconnectorhq.com/contacts/",
      {
        email: email,
        phone: phone,
        tags: ["cashfree_payment_success"],
        customFields: {
          business_type: businessType,
          order_amount: amount
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GHL_API_KEY}`,
          "Content-Type": "application/json",
          Version: "2021-07-28"
        }
      }
    );

    res.status(200).send("Payment processed successfully");

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(200).send("Error handled safely");
  }
});

// IMPORTANT: Use dynamic PORT for Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
