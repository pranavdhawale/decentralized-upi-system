const express = require("express");
const router = express.Router();
const axios = require("axios");
const redis = require("redis");

const client = redis.createClient({
  url: "redis://localhost:6379",
});
client.connect().catch(console.error);

// 🏦 List of UPI servers
const UPI_SERVERS = [
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
];

// ✅ Health check utility
async function checkServerHealth(server) {
  try {
    await axios.get(`${server}/health`);
    return true;
  } catch (error) {
    console.log(`⚠️ Server ${server} is not healthy`);
    return false;
  }
}

// 🔁 Process UPI payment
router.post("/pay", async (req, res) => {
  const { amount, sender, receiver } = req.body;

  if (!amount || !sender || !receiver) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  console.log(
    "\n==============================================================\n🔁 Processing Payment\n=============================================================="
  );
  for (const server of UPI_SERVERS) {
    console.log(`[USER] Trying UPI Server: ${server}`);

    if (!(await checkServerHealth(server))) {
      console.log(`[USER] UPI server ${server} is down. Trying next...`);
      continue;
    }

    try {
      const response = await axios.post(
        `${server}/upi/process`,
        { amount, sender, receiver },
        { validateStatus: () => true }
      );

      if (response.status === 200) {
        console.log(
          `✅ Amount successfully transferred from ${sender} to ${receiver}`
        );
      } else if (response.status === 502) {
        console.log("⚠️ Payment request cached, will retry later.");
      }

      return res.status(response.status).json(response.data);
    } catch (error) {
      console.log(
        `[USER] ❌ Error communicating with ${server}: ${error.message}`
      );
    }
  }

  // All UPI servers are down
  console.log(`[USER] ❌ All UPI Servers down. Caching request...`);
  console.log(
    "==============================================================="
  );
  const uFailedRequest = JSON.stringify({ amount, sender, receiver });
  await client.rPush("u_failed_payments", uFailedRequest);

  return res
    .status(502)
    .json({ message: "Payment request cached, will retry later." });
});

// ♻️ Retry failed transactions every 10 seconds
async function retryFailedPayments() {
  const cachedRequests = await client.lRange("u_failed_payments", 0, -1);

  if (!cachedRequests.length) {
    console.log(
      "\n=================================\n♻️ No failed requests to retry\n=================================\n"
    );
    return;
  }

  console.log(
    "\n==============================================================\n♻️ Retrying Failed Payment\n=============================================================="
  );

  for (let request of cachedRequests) {
    const { amount, sender, receiver } = JSON.parse(request);

    for (const server of UPI_SERVERS) {
      console.log(`[USER] Retrying payment to UPI Server: ${server}`);

      if (!(await checkServerHealth(server))) {
        console.log(`[USER] UPI server ${server} is down. Trying next...`);
        continue;
      }

      try {
        const response = await axios.post(
          `${server}/upi/process`,
          {
            amount,
            sender,
            receiver,
          },
          { validateStatus: () => true }
        );

        console.log(
          `[USER] ✅ Payment sent to UPI server, removing from cache.`
        );
        await client.lRem("u_failed_payments", 1, request);
        break;
      } catch (error) {
        console.log(`[USER] ❌ Server ${server} still down: ${error.message}`);
      }
    }
  }
}

setInterval(retryFailedPayments, 60000); // Run every 60 seconds

module.exports = router;
