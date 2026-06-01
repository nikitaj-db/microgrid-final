const WebSocket = require('ws');
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sequelize = require("./config/db.js");
const dotenv = require("dotenv").config();
const { transferAllData } = require("./controllers/dataTransferController");

const overviewRoutes = require("./src/overview/overview_routes.js");
const solarRoutes = require("./src/solar/solar_routes.js");
const mainsRoutes = require("./src/mains/mains_routes.js");
const gensetRoutes = require("./src/genset/genset_routes.js");
const recordsRoutes = require("./src/records/records_routes.js");
const alertRoutes = require("./src/alert/alert_routes.js");
const liveRoutes = require("./src/live/live_routes.js");

const app = express();
const PORT = process.env.PORT || 5002;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors());
app.use("/micro/overview", overviewRoutes);
app.use("/micro/solar", solarRoutes);
app.use("/micro/mains", mainsRoutes);
app.use("/micro/genset", gensetRoutes);
app.use("/micro/records", recordsRoutes);
app.use("/micro/alert", alertRoutes);
app.use("/micro/live", liveRoutes);


app.get("/", (req, res) => res.send("Hello User"));

// app.listen(PORT, "0.0.0.0", () =>
//   console.log(`Server Running on port: http://localhost:${PORT}`)
// );

const server = app.listen(5002, () => {
  console.log("Server Running on port: http://localhost:5002");
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());

    // send response back
    ws.send('Message received by server');
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

const db = require('./config/db');

app.get('/test-alert', async (req, res) => {
  try {
    const data = await db.alert.findAll();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});