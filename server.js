// server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// serve static files from ./public
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// persistent data file
const DATA_FILE = path.join(__dirname, "scaleData.json");

// init data file if missing
function ensureData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      scale: 5,
      last_updated: new Date().toISOString(),
      votes: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  }
}
ensureData();

// helpers
function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return { scale: 5, last_updated: new Date().toISOString(), votes: [] };
  }
}

function writeData(obj) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
}

// GET /api/scale
app.get("/api/scale", (req, res) => {
  const data = readData();
  res.json({
    scale: data.scale,
    base: data.scale,
    decayedAverage: null,
    votes: (data.votes || []).length
  });
});

// POST /api/vote  -> body { value: number }
app.post("/api/vote", (req, res) => {
  const value = Number(req.body.value);
  if (!Number.isFinite(value) || value < 1 || value > 10) {
    return res.status(400).json({ error: "value must be 1-10" });
  }

  const data = readData();
  data.votes = data.votes || [];
  data.votes.push({ value, timestamp: new Date().toISOString() });

  // simple average merge: average votes with base
  const voteValues = data.votes.map(v => v.value);
  const avgVotes = voteValues.reduce((a,b)=>a+b,0)/voteValues.length;
  const newScale = Math.round(((data.scale + avgVotes) / 2) * 100) / 100;

  data.scale = Math.min(10, Math.max(1, newScale));
  data.last_updated = new Date().toISOString();

  writeData(data);
  return res.json({ ok: true, scale: data.scale });
});

// fallback route - serve index.html for root (helps with Render)
app.get("/", (req,res) => {
  const index = path.join(PUBLIC_DIR, "index.html");
  if (fs.existsSync(index)) return res.sendFile(index);
  res.send("Lobby Smell Scale backend running");
});

// start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
