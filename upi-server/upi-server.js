const express = require("express");
const axios = require("axios");
const healthcheck = require("express-healthcheck");

const app = express();
app.use(express.json());

const mongoose = require("mongoose");

// Connect to MongoDB
mongoose
  .connect(
    "mongodb+srv://pranavdhawale19:6iClPt7eX2b7ZhCD@localhost.5bk9o.mongodb.net/decentralized-upi"
  )
  .then(() => console.log(`✅ Connected to MongoDB for Bank Server ${PORT}`))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const upiRoutes = require("./controller/upi.controller");
app.use("/upi", upiRoutes);

// List of Bank servers
const BANK_SERVERS = [
  "http://localhost:4001",
  "http://localhost:4002",
  "http://localhost:4003",
];

// Health check
app.use(
  "/health",
  healthcheck({
    healthy: () => ({ status: "UP", service: "UPI Server" }),
  })
);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`UPI Server running on port ${PORT}`));
