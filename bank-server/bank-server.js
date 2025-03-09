const express = require("express");

const app = express();
app.use(express.json());

app.post("/process", (req, res) => {
    const { amount, sender, receiver } = req.body;

    console.log(`[Bank Server] Processing Payment: ${sender} → ${receiver}, Amount: ₹${amount}`);
    
    // Simulating a successful transaction
    res.json({ status: "success", message: "Transaction completed successfully." });
});

// Start server
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Bank Server running on port ${PORT}`));
