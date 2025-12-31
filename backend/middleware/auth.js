const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      const error = new Error("Not authorized, token missing");
      error.status = 401;
      throw error;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const user = await User.findById(decoded.id);
    if (!user) {
      const error = new Error("Not authorized");
      error.status = 401;
      throw error;
    }

    req.user = user;
    next();
  } catch (err) {
    err.status = err.status || 401;
    next(err);
  }
};

const requireSales = (req, res, next) => {
  if (!req.user || req.user.role !== "sales") {
    const error = new Error("Sales access required");
    error.status = 403;
    throw error;
  }
  next();
};

module.exports = { protect, requireSales };
