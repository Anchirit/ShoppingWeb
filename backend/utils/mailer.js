const nodemailer = require("nodemailer");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (value) => {
  if (!value || typeof value !== "string") {
    return false;
  }
  return EMAIL_REGEX.test(value.trim());
};

const sendMail = async ({ to, subject, text }) => {
  const recipient = typeof to === "string" ? to.trim() : "";
  if (!isValidEmail(recipient)) {
    return {
      sent: false,
      reason: "invalid",
      message: "邮箱格式无效，未发送邮件。",
    };
  }

  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log(`[mail] to=${recipient} subject=${subject} text=${text}`);
    return {
      sent: false,
      reason: "not-configured",
      message: "邮件服务未配置，已跳过发送。",
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Boolean(process.env.SMTP_SECURE === "true"),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "no-reply@qiu.local",
      to: recipient,
      subject,
      text,
    });
    return { sent: true };
  } catch (error) {
    console.log(`[mail] failed to=${recipient} subject=${subject} error=${error.message}`);
    return { sent: false, reason: "failed", message: "邮件发送失败。" };
  }
};

module.exports = { sendMail, isValidEmail };
