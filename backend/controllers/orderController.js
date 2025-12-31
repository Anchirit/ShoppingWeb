const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { sendMail, isValidEmail } = require("../utils/mailer");

const createOrder = asyncHandler(async (req, res) => {
  const { items, shipping, paymentMethod, paymentProvider, paymentId } = req.body;
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
      summary: product.summary || "",
      price: product.price,
      qty,
    };
  });

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  const now = new Date();

  const provider =
    paymentProvider ||
    (paymentMethod && paymentMethod.toLowerCase().includes("stripe")
      ? "stripe"
      : paymentMethod && paymentMethod.includes("支付宝")
      ? "alipay"
      : "offline");
  const paymentPending = provider === "stripe" || provider === "alipay";
  const timeline = paymentPending
    ? [
        { label: "发起支付", at: now },
        { label: "等待支付确认", at: now },
        { label: "处理中", at: now },
      ]
    : [{ label: "付款成功", at: now }, { label: "处理中", at: now }];

  const order = await Order.create({
    user: req.user.id,
    items: orderItems,
    total,
    status: "处理中",
    timeline,
    isPaid: !paymentPending,
    paidAt: paymentPending ? null : now,
    shipping,
    payment: {
      method: paymentMethod || "银行卡",
      provider,
      status: paymentPending ? "pending" : "paid",
      id: paymentId || "",
    },
  });

  for (const item of orderItems) {
    const product = productMap.get(item.product.toString());
    if (product) {
      product.stock = Math.max(product.stock - item.qty, 0);
      await product.save();
    }
  }

  await User.findByIdAndUpdate(req.user.id, {
    $push: { logs: { action: `下单成功：${order.id}`, at: now } },
  });

  let mailWarning = "";
  if (shipping && shipping.email && !paymentPending) {
    if (!isValidEmail(shipping.email)) {
      mailWarning = "邮箱格式无效，未发送邮件。";
      order.timeline.push({ label: "邮箱无效，未发送邮件", at: new Date() });
      await order.save();
    } else {
      const registeredEmail = (req.user.email || "").toLowerCase();
      const shippingEmail = String(shipping.email || "").toLowerCase();
      const canSend = req.user.emailVerified && shippingEmail === registeredEmail;

      if (!canSend) {
        if (!req.user.emailVerified) {
          mailWarning = "邮箱未验证，未发送邮件。";
          order.timeline.push({ label: "邮箱未验证，未发送邮件", at: new Date() });
        } else {
          mailWarning = "收货邮箱需与注册邮箱一致，未发送邮件。";
          order.timeline.push({ label: "收货邮箱不一致，未发送邮件", at: new Date() });
        }
        await order.save();
      } else {
        const mailResult = await sendMail({
          to: shipping.email,
          subject: "订单确认",
          text: `您的订单 ${order.id} 已确认，金额：￥${total.toFixed(2)}`,
        });
        if (mailResult.sent) {
          order.timeline.push({ label: "已发送确认邮件", at: new Date() });
          await order.save();
        } else {
          mailWarning = mailResult.message || "邮件发送失败。";
          const failLabel =
            mailResult.reason === "not-configured" ? "邮件服务未配置" : "邮件发送失败";
          order.timeline.push({ label: failLabel, at: new Date() });
          await order.save();
        }
      }
    }
  }

  const payload = order.toJSON();
  if (mailWarning) {
    payload.mailWarning = mailWarning;
  }
  res.status(201).json(payload);
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json(orders);
});

module.exports = { createOrder, getMyOrders };
