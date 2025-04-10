// 🔁 bank-server.js

const express = require("express");
const mongoose = require("mongoose");
const redis = require("redis");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 4001;

app.use(bodyParser.json());

// Connect to MongoDB
mongoose
  .connect(
    "mongodb+srv://pranavdhawale19:6iClPt7eX2b7ZhCD@localhost.5bk9o.mongodb.net/decentralized-upi"
  )
  .then(() => console.log(`✅ Connected to MongoDB for Bank Server ${PORT}`))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  userId: String,
  balance: Number,
});

const User = mongoose.model("User", userSchema);

const client = redis.createClient({
  url: "redis://localhost:6379", // Or replace with the actual IP
});
client.connect().catch(console.error);

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.post("/process", async (req, res) => {
  const { sender, receiver, amount } = req.body;

  if (!sender || !receiver || typeof amount !== "number") {
    return res.status(400).json({ status: "fail", message: "Invalid input" });
  }

  try {
    const senderUser = await User.findOne({ userId: sender });
    const receiverUser = await User.findOne({ userId: receiver });

    if (!senderUser || !receiverUser) {
      return res
        .status(404)
        .json({ status: "fail", message: "User not found" });
    }

    if (senderUser.balance < amount) {
      return res
        .status(400)
        .json({ status: "fail", message: "Insufficient balance" });
    }

    senderUser.balance -= amount;
    receiverUser.balance += amount;

    await senderUser.save();
    await receiverUser.save();

    // log transaction
    console.log(
      "=====================================\n🏦 Transaction Details 🏦\n====================================="
    );
    const transaction = {
      sender: senderUser.userId,
      receiver: receiverUser.userId,
      amount,
      timestamp: new Date(),
    };
    console.log("Transaction:", transaction);
    console.log("=====================================");

    return res
      .status(200)
      .json({ status: "success", message: "Payment processed" });
  } catch (error) {
    console.error("❌ Processing error:", error);
    return res.status(500).json({ status: "fail", message: "Internal error" });
  }
});

// Create a new user
app.post("/user/create", async (req, res) => {
  const { userId, balance } = req.body;

  if (!userId || typeof balance !== "number" || balance < 0) {
    return res.status(400).json({ status: "fail", message: "Invalid input" });
  }

  try {
    const existing = await User.findOne({ userId });
    if (existing) {
      return res
        .status(409)
        .json({ status: "fail", message: "User already exists" });
    }

    const newUser = new User({ userId, balance });
    await newUser.save();

    return res
      .status(201)
      .json({ status: "success", message: "User created", user: newUser });
  } catch (error) {
    console.error("❌ Create user error:", error);
    return res.status(500).json({ status: "fail", message: "Internal error" });
  }
});

// Get user details (balance)
app.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findOne({ userId });
    if (!user) {
      return res
        .status(404)
        .json({ status: "fail", message: "User not found" });
    }

    return res.status(200).json({ status: "success", user });
  } catch (error) {
    console.error("❌ Get user error:", error);
    return res.status(500).json({ status: "fail", message: "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Bank Server running on port ${PORT}`);
});
