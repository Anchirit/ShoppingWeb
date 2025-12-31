const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    summary: { type: String, default: "" },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [itemSchema],
    total: { type: Number, required: true },
    status: { type: String, default: "处理中" },
    timeline: [timelineSchema],
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    shipping: {
      fullName: String,
      email: String,
      address: String,
      city: String,
      postal: String,
      country: String,
    },
    payment: {
      method: String,
      provider: String,
      status: { type: String, default: "pending" },
      id: String,
    },
  },
  { timestamps: true }
);

orderSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Order", orderSchema);
