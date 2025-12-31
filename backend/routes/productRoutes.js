const express = require("express");
const {
  getProducts,
  getCategories,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { protect, requireSales } = require("../middleware/auth");

const router = express.Router();

router.get("/", getProducts);
router.get("/categories", getCategories);
router.get("/:id", getProductById);
router.post("/", protect, requireSales, createProduct);
router.put("/:id", protect, requireSales, updateProduct);
router.delete("/:id", protect, requireSales, deleteProduct);

module.exports = router;
