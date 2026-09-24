// sockets/auctionEngine.js
const { auctions, startAuctionTimer } = require('./timerManager');

module.exports = (io, socket) => {
  // Join auction room
  socket.on('auction:join', ({ auctionId, username }) => {
    const targetId = auctionId || 'AUC_VINTAGE_99';
    const auction = auctions[targetId];

    if (!auction) {
      return socket.emit('auction:error', { message: 'Auction not found' });
    }

    socket.join(targetId);
    socket.currentAuctionId = targetId;
    socket.username = username || `Bidder_${socket.id.slice(0, 4)}`;

    auction.viewers.add(socket.id);

    // Start timer on first participant join if not already running
    startAuctionTimer(io, targetId);

    // 1. Hydrate full auction state to newly joined bidder
    socket.emit('auction:init', {
      item: {
        id: auction.id,
        title: auction.title,
        description: auction.description,
        startingPrice: auction.startingPrice,
        currentBid: auction.currentBid,
        highestBidder: auction.highestBidder ? auction.highestBidder.username : 'None',
        minIncrement: auction.minIncrement,
        status: auction.status
      },
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
      totalViewers: auction.viewers.size
    });

    // 2. Broadcast updated viewer count to room
    io.to(targetId).emit('user:joined', {
      username: socket.username,
      totalViewers: auction.viewers.size
    });
  });

  // Place a live bid
  socket.on('bid:place', ({ auctionId, amount }) => {
    const targetId = auctionId || socket.currentAuctionId;
    const auction = auctions[targetId];
    const bidderName = socket.username || 'Anonymous Bidder';
    const bidAmount = Number(amount);

    if (!auction) {
      return socket.emit('bid:rejected', { reason: 'Auction does not exist' });
    }

    // 1. Check if auction is active
    if (auction.status !== 'active' || auction.timeRemainingSeconds <= 0) {
      return socket.emit('bid:rejected', { reason: 'Auction is closed and completed' });
    }

    // 2. Check self outbid prohibition
    if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
      return socket.emit('bid:rejected', { reason: 'You are already the highest bidder' });
    }

    // 3. Check minimum increment
    const minimumRequired = auction.currentBid + auction.minIncrement;
    if (bidAmount < minimumRequired) {
      return socket.emit('bid:rejected', {
        reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString('en-IN')}`
      });
    }

    // 4. Capture previous bidder to send targeted outbid alert
    const previousBidder = auction.highestBidder;

    // 5. Update State
    auction.currentBid = bidAmount;
    auction.highestBidder = { socketId: socket.id, username: bidderName };

    const newRecord = {
      bidder: bidderName,
      amount: bidAmount,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    auction.bidHistory.unshift(newRecord);

    // 6. Anti-Snipe Rule: If bid placed within last 15 seconds, extend timer back to 20 seconds
    if (auction.timeRemainingSeconds < 15) {
      auction.timeRemainingSeconds = 20;
      io.to(targetId).emit('auction:extended', {
        timeRemaining: 20,
        message: '⚡ Anti-Snipe Protection Triggered: Clock extended to 20s!'
      });
    }

    // 7. Broadcast leading price and updated state to room
    io.to(targetId).emit('bid:success', {
      currentBid: auction.currentBid,
      highestBidder: bidderName,
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
      minIncrement: auction.minIncrement
    });

    // 8. Targeted alert strictly to displaced highest bidder
    if (previousBidder && previousBidder.socketId !== socket.id) {
      io.to(previousBidder.socketId).emit('bid:outbid', {
        message: `⚠️ Outbid Alert: ${bidderName} placed a higher bid of ₹${bidAmount.toLocaleString('en-IN')}!`
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const targetId = socket.currentAuctionId;
    if (targetId && auctions[targetId]) {
      auctions[targetId].viewers.delete(socket.id);
      io.to(targetId).emit('user:left', {
        totalViewers: auctions[targetId].viewers.size
      });
    }
  });
};
