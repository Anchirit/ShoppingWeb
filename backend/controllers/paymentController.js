const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { sendMail, isValidEmail } = require("../utils/mailer");

const getStripeClient = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  const stripe = require("stripe")(key);
  return stripe;
};

const calculateTotals = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("订单商品不能为空");
    error.status = 400;
    throw error;
  }

  const productIds = items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((product) => [product.id, product]));

  const orderItems = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      const error = new Error("订单商品不存在");
      error.status = 400;
      throw error;
    }
    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      const error = new Error("商品数量不合法");
      error.status = 400;
      throw error;
    }
    if (product.stock < qty) {
      const error = new Error(`库存不足：${product.name}`);
      error.status = 400;
      throw error;
    }
    return {
      product: product._id,
      name: product.name,
      price: product.price,
      qty,
    };
  });

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  return { total, subtotal, tax };
};

const markOrderPaid = async (order, providerLabel) => {
  const now = new Date();
  if (!order.isPaid) {
    order.isPaid = true;
    order.paidAt = now;
  }
  if (!order.payment) {
    order.payment = { method: providerLabel, provider: providerLabel };
  }
  if (!order.payment.provider) {
    order.payment.provider = providerLabel;
  }
  order.payment.status = "paid";
  if (!order.timeline.some((step) => step.label === "付款成功")) {
    order.timeline.push({ label: "付款成功", at: now });
  }

  let mailWarning = "";
  const recipient = order.shipping && order.shipping.email ? order.shipping.email : "";
  const hasEmail = order.timeline.some((step) => step.label === "已发送确认邮件");
  const userId = order.user && order.user._id ? order.user._id : order.user;
  const user = await User.findById(userId).select("email emailVerified");

  if (recipient && !hasEmail) {
    if (!isValidEmail(recipient)) {
      mailWarning = "邮箱格式无效，未发送邮件。";
      if (!order.timeline.some((step) => step.label === "邮箱无效，未发送邮件")) {
        order.timeline.push({ label: "邮箱无效，未发送邮件", at: now });
      }
    } else {
      const registeredEmail = user && user.email ? user.email.toLowerCase() : "";
      const canSend = user && user.emailVerified && recipient.toLowerCase() === registeredEmail;

      if (!canSend) {
        if (!user || !user.emailVerified) {
          mailWarning = "邮箱未验证，未发送邮件。";
          if (!order.timeline.some((step) => step.label === "邮箱未验证，未发送邮件")) {
            order.timeline.push({ label: "邮箱未验证，未发送邮件", at: now });
          }
        } else {
          mailWarning = "收货邮箱需与注册邮箱一致，未发送邮件。";
          if (!order.timeline.some((step) => step.label === "收货邮箱不一致，未发送邮件")) {
            order.timeline.push({ label: "收货邮箱不一致，未发送邮件", at: now });
          }
        }
      } else {
      const mailResult = await sendMail({
        to: recipient,
        subject: "订单确认",
        text: `您的订单 ${order.id} 已确认，金额：￥${order.total.toFixed(2)}`,
      });
      if (mailResult.sent) {
        if (!order.timeline.some((step) => step.label === "已发送确认邮件")) {
          order.timeline.push({ label: "已发送确认邮件", at: now });
        }
      } else {
        mailWarning = mailResult.message || "邮件发送失败。";
        const failLabel =
          mailResult.reason === "not-configured" ? "邮件服务未配置" : "邮件发送失败";
        if (!order.timeline.some((step) => step.label === failLabel)) {
          order.timeline.push({ label: failLabel, at: now });
        }
      }
      }
    }
  }

  await order.save();
  await User.findByIdAndUpdate(userId, {
    $push: { logs: { action: `支付成功：${order.id}（${providerLabel}）`, at: now } },
  });

  return mailWarning;
};

const createStripeIntent = asyncHandler(async (req, res) => {
  const { items } = req.body;
  const { total } = await calculateTotals(items);
  const amount = Math.round(total * 100);
  const currency = process.env.STRIPE_CURRENCY || "cny";
  const stripe = getStripeClient();

  let paymentId = `pi_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  let clientSecret = `mock_${paymentId}_secret`;

  if (stripe) {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { source: "qiu-store" },
    });
    paymentId = intent.id;
    clientSecret = intent.client_secret;
  }

  res.json({ provider: "stripe", paymentId, clientSecret, amount, currency });
});

const createAlipayIntent = asyncHandler(async (req, res) => {
  const { items } = req.body;
  const { total } = await calculateTotals(items);
  const paymentId = `alipay_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const paymentUrl = `https://openapi.alipaydev.com/gateway.do?out_trade_no=${paymentId}`;

  res.json({
    provider: "alipay",
    paymentId,
    paymentUrl,
    amount: total,
    currency: "cny",
  });
});

const stripeWebhook = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  let paymentId = payload.paymentId;
  let status = payload.status;

  if (payload.type && payload.data && payload.data.object) {
    paymentId = payload.data.object.id;
    status = payload.data.object.status;
  }

  if (!paymentId) {
    const error = new Error("缺少支付ID");
    error.status = 400;
    throw error;
  }

  if (status && status !== "succeeded" && status !== "paid") {
    res.json({ received: true });
    return;
  }

  const order = await Order.findOne({ "payment.id": paymentId });
  let mailWarning = "";
  if (order) {
    mailWarning = await markOrderPaid(order, "Stripe 沙箱");
  }

  res.json({ received: true, mailWarning });
});

const alipayWebhook = asyncHandler(async (req, res) => {
  const { paymentId, status } = req.body || {};
  if (!paymentId) {
    const error = new Error("缺少支付ID");
    error.status = 400;
    throw error;
  }

  if (status && status !== "TRADE_SUCCESS" && status !== "paid") {
    res.json({ received: true });
    return;
  }

  const order = await Order.findOne({ "payment.id": paymentId });
  let mailWarning = "";
  if (order) {
    mailWarning = await markOrderPaid(order, "支付宝沙箱");
  }

  res.json({ received: true, mailWarning });
});

module.exports = {
  createStripeIntent,
  createAlipayIntent,
  stripeWebhook,
  alipayWebhook,
};
