const express = require("express");
const cors = require("cors");
const fs = require("fs");
const cron = require("node-cron");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(express.static("."));

const DATA_FILE = "./scaleData.json";

// Initialize data file if missing
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      {
        scale: 5,               // ← unified name
        last_updated: new Date().toISOString(),
        votes: []
      },
      null,
      2
    )
  );
}

// Helper functions
function readScale() {
  const raw = fs.readFileSync(DATA_FILE);
  return JSON.parse(raw);
}

function writeScale(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}


// =========================
// 🗳️ Voting
// =========================
app.post("/api/vote", (req, res) => {
  const { value } = req.body;

  if (typeof value !== "number" || value < 1 || value > 10) {
    return res.status(400).json({ error: "Vote must be between 1 and 10." });
  }

  const data = readScale();
  data.votes = data.votes || [];

  data.votes.push({
    value,
    timestamp: new Date().toISOString()
  });

  writeScale(data);

  res.json({ message: "Vote submitted." });
});

////

// =========================
// 📉 Fading vote system
// =========================
function calculateDecayedAverage(votes) {
  const HALF_LIFE = 2;
  const now = Date.now();

  let weightedSum = 0;
  let weightTotal = 0;

  votes.forEach(v => {
    const ageHours = (now - new Date(v.timestamp).getTime()) / (1000 * 60 * 60);
    const weight = Math.pow(0.5, ageHours / HALF_LIFE);

    weightedSum += v.value * weight;
    weightTotal += weight;
  });

  return weightTotal === 0 ? null : weightedSum / weightTotal;
}

// =========================
// 📡 GET /api/scale
// =========================
app.get("/api/scale", (req, res) => {
  const data = readScale();
  const base = data.scale_value;  // ← unified name

  const decayedAverage = calculateDecayedAverage(data.votes);

  if (!decayedAverage) {
    return res.json({
      scale: base,
      base,
      decayedAverage: null,
      votes: data.votes.length
    });
  }

  const combined = base * 0.3 + decayedAverage * 0.7;

  res.json({
    scale: Number(combined.toFixed(2)),
    base,
    decayedAverage: Number(decayedAverage.toFixed(2)),
    votes: data.votes.length
  });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Lobby Smell Scale running at http://localhost:${PORT}`);

});
