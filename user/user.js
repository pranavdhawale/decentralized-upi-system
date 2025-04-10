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

const userRoutes = require("./controller/user.controller");
app.use("/user", userRoutes);

// Health check
app.use(
  "/health",
  healthcheck({
    healthy: () => ({ status: "UP", service: "Client" }),
  })
);

// Start server
const PORT = process.env.PORT || 2001;
app.listen(PORT, () => console.log(`Client user running on port ${PORT}`));
