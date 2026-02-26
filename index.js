const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Health check route
app.get('/webhook', (req, res) => {
  res.status(200).send("Webhook endpoint live");
});

app.post('/webhook', async (req, res) => {

  const payload = req.body;

  console.log("Webhook received:", JSON.stringify(payload));

  // Make sure this is Payment Form webhook
  if (payload.type !== "PAYMENT_FORM_ORDER_WEBHOOK") {
    return res.status(200).send("Not a payment form event");
  }

  const order = payload.data?.order;

  if (!order || order.order_status !== "PAID") {
    return res.status(200).send("Order not paid");
  }

  const email = order.customer_details?.customer_email || "";
  const phone = order.customer_details?.customer_phone || "";
  const amount = order.order_amount || "";

  // Extract Business Type from customer_fields array
  let businessType = "";

  const customerFields = order.customer_details?.customer_fields || [];

  customerFields.forEach(field => {
    if (field.title === "Which of these applies to you") {
      businessType = field.value;
    }
  });

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
          Version: "2021-07-28",
          "Location-Id": process.env.LOCATION_ID
        }
      }
    );

    console.log("Contact pushed to GHL successfully");

    res.status(200).send("Payment processed successfully");

  } catch (error) {
    console.error("GHL Error:", error.response?.data || error.message);
    res.status(200).send("Error handled safely");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
