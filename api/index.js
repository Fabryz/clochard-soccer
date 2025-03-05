// Serverless function for Vercel
const { Server } = require('colyseus');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const express = require('express');
const cors = require('cors');
const http = require('http');

// Import room handlers
const { SoccerRoom } = require('../server/rooms/SoccerRoom');

const app = express();

// Enable CORS
app.use(cors());

// Serve static files from the public directory
app.use(express.static('public'));

// Create HTTP server
const server = http.createServer(app);

// Create Colyseus server
const gameServer = new Server({
  transport: new WebSocketTransport({
    server
  })
});

// Register room handlers
gameServer.define('soccer', SoccerRoom);

// Listen for serverless function
module.exports = app;

// For local development, uncomment these lines
// const PORT = process.env.PORT || 3030;
// server.listen(PORT, () => {
//   console.log(`🚀 Server started on http://localhost:${PORT}`);
//   console.log(`🎮 Colyseus server is running...`);
// });
