const express = require("express");
const {
  register,
  login,
  getMe,
  verifyEmail,
  resendVerification,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.post("/verify", protect, verifyEmail);
router.post("/resend", protect, resendVerification);

module.exports = router;
