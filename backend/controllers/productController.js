const Product = require("../models/Product");
const asyncHandler = require("../utils/asyncHandler");

const getProducts = asyncHandler(async (req, res) => {
  const { search, category, page, limit, all } = req.query;
  const filter = {};
  if (category && category !== "all") {
    filter.category = category;
  }
  if (search) {
    filter.$or = [
      { name: new RegExp(search, "i") },
      { summary: new RegExp(search, "i") },
    ];
  }

  if (all === "true") {
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ items: products, page: 1, totalPages: 1, total: products.length });
    return;
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 9, 1), 60);
  const total = await Product.countDocuments(filter);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const products = await Product.find(filter)
    .sort({ createdAt: -1 })
    .skip((pageNumber - 1) * pageSize)
    .limit(pageSize);
  res.json({ items: products, page: pageNumber, totalPages, total, limit: pageSize });
});

const getCategories = asyncHandler(async (_req, res) => {
  const categories = await Product.distinct("category");
  res.json(categories.filter(Boolean));
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    const error = new Error("商品不存在");
    error.status = 404;
    throw error;
  }
  res.json(product);
});

const createProduct = asyncHandler(async (req, res) => {
  const { name, category, price, stock, summary, colors, image } = req.body;
  if (!name || !category || price == null || stock == null) {
    const error = new Error("商品名称、分类、价格和库存不能为空");
    error.status = 400;
    throw error;
  }
  if (Number(price) < 0 || Number(stock) < 0) {
    const error = new Error("价格和库存必须为正数");
    error.status = 400;
    throw error;
  }

  const product = await Product.create({
    name,
    category,
    price: Number(price),
    stock: Number(stock),
    summary: summary || "",
    image: image || "",
    colors: Array.isArray(colors) ? colors : [],
  });

  res.status(201).json(product);
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    const error = new Error("商品不存在");
    error.status = 404;
    throw error;
  }

  const { name, category, price, stock, summary, colors, image } = req.body;
  if (name) product.name = name;
  if (category) product.category = category;
  if (price != null) product.price = Number(price);
  if (stock != null) product.stock = Number(stock);
  if (product.price < 0 || product.stock < 0) {
    const error = new Error("价格和库存必须为正数");
    error.status = 400;
    throw error;
  }
  if (summary != null) product.summary = summary;
  if (image != null) product.image = image;
  if (Array.isArray(colors)) product.colors = colors;

  const updated = await product.save();
  res.json(updated);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    const error = new Error("商品不存在");
    error.status = 404;
    throw error;
  }
  await product.deleteOne();
  res.json({ message: "商品已删除" });
});

module.exports = {
  getProducts,
  getCategories,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
