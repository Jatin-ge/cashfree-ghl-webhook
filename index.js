const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

app.get('/webhook', (req, res) => {
  res.status(200).send("Webhook endpoint live");
});

app.post('/webhook', async (req, res) => {

  const payload = req.body;
  console.log("Webhook received:", JSON.stringify(payload));

  if (payload.type !== "PAYMENT_FORM_ORDER_WEBHOOK") {
    return res.status(200).send("Not payment form event");
  }

  const order = payload.data?.order;

  if (!order || order.order_status !== "PAID") {
    return res.status(200).send("Order not paid");
  }

  const email = order.customer_details?.customer_email || "";
  const phone = order.customer_details?.customer_phone || "";
  const amount = order.order_amount || "";

  const fullName = order.customer_details?.customer_name || "";

  // Split name safely
  const nameParts = fullName.trim().split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  let businessType = "";

  const customerFields = order.customer_details?.customer_fields || [];

  customerFields.forEach(field => {
    if (field.title === "Which of these applies to you") {
      businessType = field.value;
    }
  });

  try {
    await axios.post(
      "https://services.leadconnectorhq.com/contacts/upsert",
      {
        locationId: process.env.LOCATION_ID,
        email: email,
        phone: phone,
        firstName: firstName,
        lastName: lastName,
        tags: ["cashfree_payment_success"],
        customFields: [
          {
            id: "business_type",
            value: businessType
          },
          {
            id: "order_amount",
            value: amount
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GHL_API_KEY}`,
          Version: "2021-07-28",
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Contact pushed to GHL successfully");

    res.status(200).send("Payment processed");

  } catch (error) {
    console.error("GHL Error:", error.response?.data || error.message);
    res.status(200).send("Error handled safely");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
