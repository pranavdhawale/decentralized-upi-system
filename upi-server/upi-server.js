const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// List of Bank servers
const BANK_SERVERS = ["http://localhost:4001", "http://localhost:4002", "http://localhost:4003"];

// Process payment request
async function processPayment(req, res) {
    const { amount, sender, receiver } = req.body;

    for (const bank of BANK_SERVERS) {
        try {
            console.log(`[UPI Server] Forwarding to Bank Server: ${bank}`);
            const response = await axios.post(`${bank}/process`, { amount, sender, receiver });
            return res.json(response.data);
        } catch (error) {
            console.log(`[UPI Server] Bank server ${bank} failed, trying next...`);
        }
    }

    console.log(`[UPI Server] All bank servers are down. Caching request...`);
    res.status(500).json({ message: "Payment request cached, will retry later." });
}

// Payment route
app.post("/pay", processPayment);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`UPI Server running on port ${PORT}`));
