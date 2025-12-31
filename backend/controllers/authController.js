const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { sendMail, isValidEmail } = require("../utils/mailer");

const ISSUE_MINUTES = 10;

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });

const generateCode = () => String(crypto.randomInt(100000, 1000000));

const hashCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");

const issueVerificationCode = async (user) => {
  const code = generateCode();
  user.emailVerificationCodeHash = hashCode(code);
  user.emailVerificationExpires = new Date(Date.now() + ISSUE_MINUTES * 60 * 1000);
  await user.save();
  return code;
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, salesCode } = req.body;
  if (!name || !email || !password) {
    const error = new Error("姓名、邮箱和密码不能为空");
    error.status = 400;
    throw error;
  }
  if (!isValidEmail(email)) {
    const error = new Error("邮箱格式不正确");
    error.status = 400;
    throw error;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    const error = new Error("邮箱已注册");
    error.status = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let finalRole = "customer";
  if (salesCode || role === "sales") {
    if (!process.env.SALES_REGISTRATION_CODE) {
      const error = new Error("销售账号注册已关闭");
      error.status = 403;
      throw error;
    }
    if (salesCode !== process.env.SALES_REGISTRATION_CODE) {
      const error = new Error("销售注册码无效");
      error.status = 403;
      throw error;
    }
    finalRole = "sales";
  }
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: finalRole,
  });

  const code = await issueVerificationCode(user);
  const mailResult = await sendMail({
    to: user.email,
    subject: "邮箱验证码",
    text: `您的邮箱验证码为：${code}，${ISSUE_MINUTES} 分钟内有效。`,
  });

  const token = generateToken(user.id);
  res.status(201).json({
    token,
    user: user.toJSON(),
    mailWarning: mailResult.sent ? "" : mailResult.message,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    const error = new Error("邮箱和密码不能为空");
    error.status = 400;
    throw error;
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash"
  );
  if (!user) {
    const error = new Error("账号或密码错误");
    error.status = 401;
    throw error;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    const error = new Error("账号或密码错误");
    error.status = 401;
    throw error;
  }

  const token = generateToken(user.id);
  res.json({ token, user: user.toJSON() });
});

const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toJSON() });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) {
    const error = new Error("请输入邮箱验证码");
    error.status = 400;
    throw error;
  }

  const user = await User.findById(req.user.id).select(
    "+emailVerificationCodeHash +emailVerificationExpires"
  );
  if (!user) {
    const error = new Error("用户不存在");
    error.status = 404;
    throw error;
  }
  if (user.emailVerified) {
    res.json({ user: user.toJSON(), message: "邮箱已验证" });
    return;
  }

  if (!user.emailVerificationCodeHash || !user.emailVerificationExpires) {
    const error = new Error("验证码不存在，请重新发送");
    error.status = 400;
    throw error;
  }

  if (user.emailVerificationExpires.getTime() < Date.now()) {
    const error = new Error("验证码已过期，请重新发送");
    error.status = 400;
    throw error;
  }

  const hashed = hashCode(String(code).trim());
  if (hashed !== user.emailVerificationCodeHash) {
    const error = new Error("验证码错误");
    error.status = 400;
    throw error;
  }

  user.emailVerified = true;
  user.emailVerificationCodeHash = undefined;
  user.emailVerificationExpires = undefined;
  user.logs = user.logs || [];
  user.logs.push({ action: "邮箱验证通过", at: new Date() });
  await user.save();

  res.json({ user: user.toJSON(), message: "邮箱验证成功" });
});

const resendVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    const error = new Error("用户不存在");
    error.status = 404;
    throw error;
  }
  if (user.emailVerified) {
    res.json({ message: "邮箱已验证，无需重新发送" });
    return;
  }

  const code = await issueVerificationCode(user);
  const mailResult = await sendMail({
    to: user.email,
    subject: "邮箱验证码",
    text: `您的邮箱验证码为：${code}，${ISSUE_MINUTES} 分钟内有效。`,
  });

  res.json({
    message: mailResult.sent ? "验证码已发送" : mailResult.message,
    mailWarning: mailResult.sent ? "" : mailResult.message,
  });
});

module.exports = { register, login, getMe, verifyEmail, resendVerification };
