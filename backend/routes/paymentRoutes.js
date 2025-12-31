const express = require("express");
const {
  createStripeIntent,
  createAlipayIntent,
  stripeWebhook,
  alipayWebhook,
} = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/stripe/intent", protect, createStripeIntent);
router.post("/alipay/intent", protect, createAlipayIntent);
router.post("/stripe/webhook", stripeWebhook);
router.post("/alipay/webhook", alipayWebhook);

module.exports = router;
