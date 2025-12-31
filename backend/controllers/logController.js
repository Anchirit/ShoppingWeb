const asyncHandler = require("../utils/asyncHandler");

const logActivity = asyncHandler(async (req, res) => {
  const { action } = req.body;
  if (!action) {
    const error = new Error("日志内容不能为空");
    error.status = 400;
    throw error;
  }

  req.user.logs.push({ action, at: new Date() });
  await req.user.save();
  res.status(201).json({ message: "Logged" });
});

module.exports = { logActivity };
