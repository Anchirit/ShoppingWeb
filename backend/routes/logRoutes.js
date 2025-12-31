const express = require("express");
const { logActivity } = require("../controllers/logController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/", protect, logActivity);

module.exports = router;
