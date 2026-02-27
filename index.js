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

  // =========================
  // CUSTOMER BASIC INFO
  // =========================

  const email = order.customer_details?.customer_email || "";
  const phone = order.customer_details?.customer_phone || "";
  const amount = order.order_amount || "";
  const fullName = order.customer_details?.customer_name || "";

  const nameParts = fullName.trim().split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // =========================
  // BUSINESS TYPE EXTRACTION
  // =========================

  let businessType = "";
  let businessTag = "";

  const customerFields = order.customer_details?.customer_fields || [];

  customerFields.forEach(field => {
    if (field.title === "Which of these applies to you") {
      businessType = field.value;

      if (businessType.includes("Ecommerce")) {
        businessTag = "segment_ecommerce";
      }

      if (businessType.includes("Agency")) {
        businessTag = "segment_agency";
      }

      if (businessType.includes("Freelancer")) {
        businessTag = "segment_freelancer";
      }
    }
  });

  // =========================
  // PRODUCT DETECTION
  // =========================

  const amountDetails = order.amount_details || [];
  let purchasedProducts = [];
  let productTags = [];

  amountDetails.forEach(item => {
    const value = parseFloat(item.value);

    if (value > 0) {
      purchasedProducts.push(item.title);

      if (item.title.includes("Top 5 Winning D2C Brand Funnel Breakdown")) {
        productTags.push("product_funnel_breakdown");
      }

      if (item.title.includes("Advanced D2C Growth Kit")) {
        productTags.push("product_growth_kit");
      }

      if (item.title.includes("Personalized D2C Growth Audit")) {
        productTags.push("product_growth_audit");
      }
    }
  });

  // =========================
  // FINAL TAG LIST
  // =========================

  const finalTags = [
    "cashfree_payment_success",
    businessTag,
    ...productTags
  ].filter(Boolean);

  try {

    await axios.post(
      "https://services.leadconnectorhq.com/contacts/upsert",
      {
        locationId: process.env.LOCATION_ID,
        email: email,
        phone: phone,
        firstName: firstName,
        lastName: lastName,
        tags: finalTags,
        customFields: [
          {
            id: "business_type",
            value: businessType
          },
          {
            id: "order_amount",
            value: amount
          },
          {
            id: "products_purchased",
            value: purchasedProducts.join(", ")
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
