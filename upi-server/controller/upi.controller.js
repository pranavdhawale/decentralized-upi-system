const express = require("express");
const router = express.Router();
const axios = require("axios");
const redis = require("redis");

// 🔗 Redis client setup
const client = redis.createClient({
  url: "redis://localhost:6379",
});
client.connect().catch(console.error);

// 🏦 List of Bank servers
const BANK_SERVERS = [
  "http://localhost:4001",
  "http://localhost:4002",
  "http://localhost:4003",
];

// 🔁 UPI Server Setup
const UPI_PORTS = [3001, 3002, 3003];
const CURRENT_PORT = parseInt(process.env.PORT) || 3001;
const UPI_SERVERS = UPI_PORTS.map((port) => `http://localhost:${port}`);

let isRetryLeader = false;

// ✅ Health check utility
async function checkServerHealth(server) {
  try {
    const res = await axios.get(`${server}/health`);
    return res.status === 200;
  } catch {
    return false;
  }
}

// 🔁 Retry failed transactions from Redis
async function retryFailedPayments() {
  const cachedRequests = await client.lRange("failed_payments", 0, -1);
  if (cachedRequests.length === 0) {
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
    let success = false;

    for (const bank of BANK_SERVERS) {
      try {
        console.log(`[UPI Server ${CURRENT_PORT}] 🔁 Retrying to: ${bank}`);

        const response = await axios.post(
          `${bank}/process`,
          { amount, sender, receiver },
          { validateStatus: () => true }
        );

        if (response.status === 200 && response.data.status === "success") {
          console.log(
            `[UPI Server ${CURRENT_PORT}] ✅ Payment ₹${amount} from ${sender} to ${receiver} succeeded, removing from cache.`
          );
          await client.lRem("failed_payments", 1, request);
          success = true;
          break;
        }
      } catch (err) {
        console.log(
          `[UPI Server ${CURRENT_PORT}] ❌ Bank ${bank} down: ${err.message}`
        );
      }
    }

    if (!success) {
      console.log(
        `[UPI Server ${CURRENT_PORT}] 🔄 Retry failed for ₹${amount} from ${sender} to ${receiver}`
      );
    }
    console.log(
      "=============================================================="
    );
  }
}

// 🔁 Leader election every 10s, trigger retry immediately if elected
async function electRetryLeader() {
  const healthyServers = [];

  for (const server of UPI_SERVERS) {
    if (await checkServerHealth(server)) healthyServers.push(server);
  }

  const leaderPort = healthyServers
    .map((s) => parseInt(s.split(":").pop()))
    .sort((a, b) => a - b)[0];

  if (leaderPort === CURRENT_PORT) {
    if (!isRetryLeader) {
      console.log(`[UPI Server ${CURRENT_PORT}] 🟢 Elected as retry leader`);
    }
    isRetryLeader = true;
    await retryFailedPayments(); // Run retry logic if leader
  } else {
    if (isRetryLeader) {
      console.log(`[UPI Server ${CURRENT_PORT}] 🔴 Lost retry leadership`);
    }
    isRetryLeader = false;
  }
}

// ⏱ Start leader election loop
setTimeout(electRetryLeader, 3000); // Initial delay
setInterval(electRetryLeader, 10000); // Re-elect every 10s

// 💸 Process UPI Payment Request
router.post("/process", async (req, res) => {
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

  for (const server of BANK_SERVERS) {
    console.log(`[UPI Server ${CURRENT_PORT}] Forwarding to Bank: ${server}`);

    if (!(await checkServerHealth(server))) {
      console.log(`[UPI Server] ❌ Bank ${server} down. Trying next...`);
      continue;
    }

    try {
      const response = await axios.post(`${server}/process`, {
        amount,
        sender,
        receiver,
      });

      return res.status(response.status).json(response.data);
    } catch (err) {
      if (err.response) {
        return res.status(err.response.status).json(err.response.data);
      } else {
        console.log(
          `[UPI Server] ⚠️ Error sending request to ${server}: ${err.message}`
        );
        continue;
      }
    }
  }

  // Cache the request if all banks are down
  console.log(`[UPI Server] ❌ All bank servers down. Caching request...`);
  console.log(
    "==============================================================="
  );
  const failedRequest = JSON.stringify({ amount, sender, receiver });
  await client.rPush("failed_payments", failedRequest);

  return res
    .status(502)
    .json({ message: "Payment request cached, will retry later." });
});

module.exports = router;
