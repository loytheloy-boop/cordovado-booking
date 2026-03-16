// ==============================
// FILE: backend/server.js
// ==============================
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, "data");
const bookingsFile = path.join(dataDir, "bookings.json");

app.use(cors());
app.use(express.json());

const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

// ==============================
// LETTURA E SCRITTURA FILE
// ==============================
function readBookings() {
  if (!fs.existsSync(bookingsFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(bookingsFile, "utf-8"));
  } catch (e) {
    console.error("Errore parsing bookings.json:", e);
    return [];
  }
}

function writeBookings(bookings) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2), "utf-8");
}

// ==============================
// OVERLAP DATE
// ==============================
function rangesOverlap(startA, endA, startB, endB) {
  const aStart = new Date(startA);
  const aEnd = new Date(endA);
  const bStart = new Date(startB);
  const bEnd = new Date(endB);
  return aStart <= bEnd && bStart <= aEnd;
}

// ==============================
// SMTP (opzionale)
// ==============================
let transporter = null;
if (
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  process.env.NOTIFY_EMAILS
) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else {
  console.warn("SMTP non configurato. Le email NON verranno inviate.");
}

// ==============================
// API
// ==============================
app.get("/", (req, res) => {
  res.send("Backend attivo e funzionante!");
});

// GET PRENOTAZIONI
app.get("/api/bookings", (req, res) => {
  res.json(readBookings());
});

// POST PRENOTAZIONE
app.post("/api/bookings", async (req, res) => {
  const { name, startDate, endDate } = req.body;

  if (!name || !startDate || !endDate)
    return res.status(400).json({ error: "Dati mancanti" });

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start) || isNaN(end))
    return res.status(400).json({ error: "Date non valide" });

  if (end < start)
    return res.status(400).json({
      error: "La data di fine non può essere precedente alla data di inizio"
    });

  const bookings = readBookings();

  const overlap = bookings.some((b) =>
    rangesOverlap(startDate, endDate, b.startDate, b.endDate)
  );

  if (overlap)
    return res.status(409).json({ error: "Le date selezionate sono già occupate" });

  const newBooking = {
    id: Date.now(),
    name,
    startDate,
    endDate
  };

  bookings.push(newBooking);
  writeBookings(bookings);

  res.status(201).json(newBooking);
});

// ==============================
// DELETE PRENOTAZIONE
// ==============================
app.delete("/api/bookings/:id", (req, res) => {
  const id = Number(req.params.id);

  let bookings = readBookings();
  const newList = bookings.filter(b => b.id !== id);

  if (newList.length === bookings.length) {
    return res.status(404).json({ error: "Prenotazione non trovata" });
  }

  writeBookings(newList);
  res.json({ success: true });
});

// ==============================
// AVVIO SERVER
// ==============================
app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});
