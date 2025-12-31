const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const User = require("./models/User");
const Product = require("./models/Product");

const seed = async () => {
  await connectDB();

  const users = [
    {
      name: "丘先生-销售",
      email: "sales@qiu.store",
      password: "sales123",
      role: "sales",
      emailVerified: true,
    },
    {
      name: "示例顾客",
      email: "customer@qiu.store",
      password: "customer123",
      role: "customer",
      emailVerified: true,
    },
  ];

  for (const entry of users) {
    const existing = await User.findOne({ email: entry.email });
    if (!existing) {
      const passwordHash = await bcrypt.hash(entry.password, 10);
      await User.create({
        name: entry.name,
        email: entry.email,
        passwordHash,
        role: entry.role,
        emailVerified: entry.emailVerified,
      });
    }
  }

  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    await Product.insertMany([
      {
        name: "星河台灯",
        category: "家居",
        price: 129,
        stock: 18,
        summary: "柔光环形台灯，支持无级调光。",
        colors: ["#f1c76a", "#f1775b"],
      },
      {
        name: "山岚旅行包",
        category: "出行",
        price: 186,
        stock: 24,
        summary: "模块化收纳空间，轻装上路。",
        colors: ["#6bb4ff", "#c97bf2"],
      },
      {
        name: "信号咖啡套装",
        category: "厨房",
        price: 78,
        stock: 32,
        summary: "陶瓷保温杯组，口感更顺滑。",
        colors: ["#27b7a9", "#f1c76a"],
      },
      {
        name: "录音室耳机",
        category: "数码",
        price: 249,
        stock: 12,
        summary: "层次清晰的监听级声音表现。",
        colors: ["#1f3852", "#6bb4ff"],
      },
      {
        name: "律动健身套装",
        category: "健康",
        price: 92,
        stock: 20,
        summary: "弹力带配训练卡，随时开练。",
        colors: ["#27b7a9", "#1f3852"],
      },
      {
        name: "云影智能音箱",
        category: "数码",
        price: 199,
        stock: 14,
        summary: "沉浸式音场，智能语音助手。",
        colors: ["#f1775b", "#6bb4ff"],
      },
    ]);
  }

  console.log("Seed complete");
  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
