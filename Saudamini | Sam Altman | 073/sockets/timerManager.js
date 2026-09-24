// sockets/timerManager.js

// Global In-Memory Live Auctions Store
const auctions = {
  AUC_VINTAGE_99: {
    id: 'AUC_VINTAGE_99',
    title: '1967 Vintage Fender Stratocaster',
    description: 'Original sunburst finish, museum condition rare vintage electric guitar.',
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null, // { socketId, username }
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: 'active', // 'active', 'sold'
    bidHistory: [
      {
        bidder: 'System Starting Reserve',
        amount: 50000,
        timestamp: 'Starting Bid'
      }
    ],
    timerInterval: null,
    viewers: new Set()
  },
  AUC_ROLEX_01: {
    id: 'AUC_ROLEX_01',
    title: 'Rolex Submariner Date 1998',
    description: 'Stainless steel black dial luxury chronometer with original box.',
    startingPrice: 120000,
    currentBid: 120000,
    highestBidder: null,
    minIncrement: 5000,
    timeRemainingSeconds: 90,
    status: 'active',
    bidHistory: [
      {
        bidder: 'System Starting Reserve',
        amount: 120000,
        timestamp: 'Starting Bid'
      }
    ],
    timerInterval: null,
    viewers: new Set()
  }
};

function startAuctionTimer(io, auctionId) {
  const auction = auctions[auctionId];
  if (!auction || auction.timerInterval) return;

  auction.timerInterval = setInterval(() => {
    if (auction.status !== 'active') {
      clearInterval(auction.timerInterval);
      auction.timerInterval = null;
      return;
    }

    auction.timeRemainingSeconds--;

    // Broadcast 1-second tick
    io.to(auction.id).emit('auction:time_tick', {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds
    });

    if (auction.timeRemainingSeconds <= 0) {
      clearInterval(auction.timerInterval);
      auction.timerInterval = null;
      auction.status = 'sold';

      const winnerName = auction.highestBidder ? auction.highestBidder.username : 'No Bidder';
      io.to(auction.id).emit('auction:sold', {
        auctionId: auction.id,
        winner: winnerName,
        finalPrice: auction.currentBid,
        status: 'sold'
      });
    }
  }, 1000);
}

module.exports = {
  auctions,
  startAuctionTimer
};
