const express = require('express');
const http = require('http');
const { Server } = require('colyseus');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { SoccerRoom } = require('./server/rooms/SoccerRoom');
const path = require('path');
const cors = require('cors');

const port = process.env.PORT || 3030;
const app = express();

// Enable CORS
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP & WebSocket servers
const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server
  })
});

// Register the SoccerRoom with options
gameServer.define('soccer_room', SoccerRoom, {
  // Dispose of rooms when they're empty
  // This ensures that rooms are cleaned up when all players leave
  pingInterval: 5000, // 5 seconds
  gracefullyShutdown: false
});

// Listen on specified port
server.listen(port, () => {
  console.log(`🚀 Server started on http://localhost:${port}`);
  console.log(`🎮 Colyseus server is running...`);
});
