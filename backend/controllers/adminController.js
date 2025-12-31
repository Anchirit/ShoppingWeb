const Order = require("../models/Order");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { sendMail, isValidEmail } = require("../utils/mailer");

const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find()
    .sort({ createdAt: -1 })
    .populate("user", "name email emailVerified");
  res.json(orders);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id).populate(
    "user",
    "email name emailVerified"
  );
  if (!order) {
    const error = new Error("订单不存在");
    error.status = 404;
    throw error;
  }

  order.status = status || order.status;
  const alreadyLogged = order.timeline.some((step) => step.label === order.status);
  if (!alreadyLogged) {
    order.timeline.push({ label: order.status, at: new Date() });
  }
  await order.save();

  let mailWarning = "";
  if (order.status === "已送达") {
    const recipient = order.shipping && order.shipping.email ? order.shipping.email : null;
    const userId = order.user && order.user._id ? order.user._id : order.user;
    await User.findByIdAndUpdate(userId, {
      $push: { logs: { action: `订单已送达：${order.id}`, at: new Date() } },
    });
    if (recipient) {
      if (!isValidEmail(recipient)) {
        mailWarning = "邮箱格式无效，未发送收货确认邮件。";
        if (!order.timeline.some((step) => step.label === "邮箱无效，未发送收货确认邮件")) {
          order.timeline.push({ label: "邮箱无效，未发送收货确认邮件", at: new Date() });
        }
        await order.save();
      } else {
        const registeredEmail =
          order.user && order.user.email ? order.user.email.toLowerCase() : "";
        const canSend =
          order.user &&
          order.user.emailVerified &&
          recipient.toLowerCase() === registeredEmail;

        if (!canSend) {
          if (!order.user || !order.user.emailVerified) {
            mailWarning = "邮箱未验证，未发送收货确认邮件。";
            if (
              !order.timeline.some((step) => step.label === "邮箱未验证，未发送收货确认邮件")
            ) {
              order.timeline.push({
                label: "邮箱未验证，未发送收货确认邮件",
                at: new Date(),
              });
            }
          } else {
            mailWarning = "收货邮箱需与注册邮箱一致，未发送收货确认邮件。";
            if (
              !order.timeline.some(
                (step) => step.label === "收货邮箱不一致，未发送收货确认邮件"
              )
            ) {
              order.timeline.push({
                label: "收货邮箱不一致，未发送收货确认邮件",
                at: new Date(),
              });
            }
          }
          await order.save();
        } else {
          const mailResult = await sendMail({
            to: recipient,
            subject: "收货确认",
            text: `订单 ${order.id} 已送达，感谢您的购买。`,
          });
          if (mailResult.sent) {
            if (!order.timeline.some((step) => step.label === "已发送收货确认邮件")) {
              order.timeline.push({ label: "已发送收货确认邮件", at: new Date() });
            }
            await order.save();
          } else {
            mailWarning = mailResult.message || "邮件发送失败。";
            const failLabel =
              mailResult.reason === "not-configured" ? "邮件服务未配置" : "邮件发送失败";
            if (!order.timeline.some((step) => step.label === failLabel)) {
              order.timeline.push({ label: failLabel, at: new Date() });
            }
            await order.save();
          }
        }
      }
    }
  }

  const payload = order.toJSON();
  if (mailWarning) {
    payload.mailWarning = mailWarning;
  }
  res.json(payload);
});

const getStats = asyncHandler(async (req, res) => {
  const orders = await Order.find({ isPaid: true });
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const dailyMap = {};
  orders.forEach((order) => {
    const key = order.createdAt.toISOString().slice(0, 10);
    dailyMap[key] = (dailyMap[key] || 0) + order.total;
  });
  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .slice(-7)
    .map(([key, value]) => ({
      label: key,
      value,
    }));
  res.json({ count: orders.length, revenue, daily });
});

const getCustomers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  const orders = await Order.find().select("user total");
  const totals = new Map();
  orders.forEach((order) => {
    const key = order.user.toString();
    const current = totals.get(key) || { count: 0, total: 0 };
    current.count += 1;
    current.total += order.total;
    totals.set(key, current);
  });

  const payload = users.map((user) => {
    const entry = totals.get(user.id) || { count: 0, total: 0 };
    return {
      ...user.toJSON(),
      orderCount: entry.count,
      orderTotal: entry.total,
    };
  });
  res.json(payload);
});

module.exports = { getOrders, updateOrderStatus, getStats, getCustomers };
