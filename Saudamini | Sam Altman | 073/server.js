require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const auctionEngine = require('./sockets/auctionEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io Connection Router
io.on('connection', (socket) => {
  console.log(`🔨 Auction Trader Connected: ${socket.id}`);

  auctionEngine(io, socket);

  socket.on('disconnect', () => {
    console.log(`❌ Auction Trader Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🔨 Real-Time Live Auction Server running at http://localhost:${PORT}`);
});
