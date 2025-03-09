const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());


// List of UPI servers
const UPI_SERVERS = ["http://localhost:3001", "http://localhost:3002", "http://localhost:3003"];

// Function to send payment
async function sendPayment(amount, sender, receiver) {
    for (const server of UPI_SERVERS) {
        try {
            console.log(`[${sender}] Trying UPI Server: ${server}`);
            const response = await axios.post(`${server}/pay`, { amount, sender, receiver });
            console.log(`[${sender}] Payment Response:`, response.data);
            return;
        } catch (error) {
            console.log(`[${sender}] Failed to connect to ${server}, trying next...`);
        }
    }
    console.log(`[${sender}] All UPI servers are down. Caching request...`);
}

// Payment route
app.post("/pay", (req, res) => {
    const { amount, sender, receiver } = req.body;

    console.log(`[${sender}] Initiating Payment: ₹${amount} to ${receiver}`);
    sendPayment(amount, sender, receiver);

    res.json({ message: "Payment request sent." });
});

// Start server
const PORT = process.env.PORT || 2001;
app.listen(PORT, () => console.log(`Client user running on port ${PORT}`));