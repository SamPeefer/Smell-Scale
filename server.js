// ===============================
// CLEAN LOBBY SMELL SCALE BACKEND
// ===============================

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const cron = require("node-cron");

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------
// DATA FILE
// ---------------------
const DATA_FILE = "./scaleData.json";

// Initialize data file if missing
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      {
        scale_value: 5,
        votes: [],
        last_updated: new Date().toISOString(),
      },
      null,
      2
    )
  );
}

// Read/write helper functions
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---------------------
// DAILY SCHEDULE
// ---------------------
// Example schedule — adjust as needed
const DAILY_SCHEDULE = [
  { time: "00:00", action: "set", value: 10 },
  { time: "02:00", action: "change", value: -1 },
  { time: "04:00", action: "change", value: -1 },
  { time: "06:00", action: "change", value: -1 },
  { time: "08:00", action: "change", value: -1 },
  { time: "20:00", action: "change", value: +1 },
  { time: "22:00", action: "change", value: +1 },
];

// Schedule jobs
DAILY_SCHEDULE.forEach((task) => {
  const [hour, minute] = task.time.split(":");
  const cronTime = `${minute} ${hour} * * *`;

  cron.schedule(cronTime, () => {
    const data = readData();

    if (task.action === "set") {
      data.scale_value = task.value;
    } else if (task.action === "change") {
      data.scale_value = Math.min(
        10,
        Math.max(1, data.scale_value + task.value)
      );
    }

    data.last_updated = new Date().toISOString();
    writeData(data);

    console.log(`Scheduled update at ${task.time}: now ${data.scale_value}`);
  });
});

// ---------------------
// VOTING
// ---------------------
app.post("/api/vote", (req, res) => {
  const { value } = req.body;

  if (typeof value !== "number" || value < 1 || value > 10) {
    return res.status(400).json({ error: "Vote must be 1–10." });
  }

  const data = readData();
  data.votes.push({
    value,
    timestamp: new Date().toISOString(),
  });

  writeData(data);

  res.json({ message: "Vote recorded!" });
});

// ---------------------
// DECAY MATH (HALF-LIFE)
// ---------------------
function decayedAverage(votes) {
  const HALF_LIFE_HOURS = 1; // change if you want
  const now = Date.now();

  let sum = 0;
  let totalWeight = 0;

  for (const v of votes) {
    const ageHours =
      (now - new Date(v.timestamp).getTime()) / (1000 * 60 * 60);

    const weight = Math.pow(0.5, ageHours / HALF_LIFE_HOURS);

    sum += v.value * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;
  return sum / totalWeight;
}

// ---------------------
// CURRENT SCALE ENDPOINT
// ---------------------
app.get("/api/scale", (req, res) => {
  const data = readData();
  const faded = decayedAverage(data.votes);

  if (faded === null) {
    // no votes → show base
    return res.json({
      scale: data.scale_value,
      base: data.scale_value,
      votes: 0,
      decayed: null,
    });
  }

  // Blend base smell + votes
  const blended = data.scale_value * 0.3 + faded * 0.7;

  res.json({
    scale: Number(blended.toFixed(2)),
    base: data.scale_value,
    decayed: Number(faded.toFixed(2)),
    votes: data.votes.length,
  });
});

// ---------------------
// SERVER START
// ---------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Smell Scale backend running on port " + PORT);
});

