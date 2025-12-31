const express = require("express");
const {
  getOrders,
  updateOrderStatus,
  getStats,
  getCustomers,
} = require("../controllers/adminController");
const { protect, requireSales } = require("../middleware/auth");

const router = express.Router();

router.get("/orders", protect, requireSales, getOrders);
router.put("/orders/:id/status", protect, requireSales, updateOrderStatus);
router.get("/stats", protect, requireSales, getStats);
router.get("/customers", protect, requireSales, getCustomers);

module.exports = router;
