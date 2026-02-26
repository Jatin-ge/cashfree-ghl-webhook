const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

app.get('/webhook', (req, res) => {
  res.status(200).send("Webhook endpoint live");
});

app.post('/webhook', async (req, res) => {

  const data = req.body;

  console.log("Webhook received:", JSON.stringify(data));

  if (!data.payment_status || data.payment_status !== "SUCCESS") {
    return res.status(200).send("Webhook received");
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

    res.status(200).send("Payment processed");

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(200).send("Error handled safely");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
