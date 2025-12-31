const path = require("path");
const express = require("express");
const multer = require("multer");
const { protect, requireSales } = require("../middleware/auth");

const router = express.Router();
const uploadDir = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
    return;
  }
  cb(new Error("仅支持图片文件"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.post("/", protect, requireSales, upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "未找到上传文件" });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

module.exports = router;
