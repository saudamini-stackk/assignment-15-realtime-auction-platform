// public/app.js
const socket = io();

// State
let currentAuctionId = 'AUC_VINTAGE_99';
let username = prompt('Enter your Bidder Name:') || `Bidder_${Math.floor(Math.random() * 1000)}`;
let currentLeadingBid = 50000;
let minIncrement = 2000;

// DOM Elements
const lotTitle = document.getElementById('lot-title');
const lotDesc = document.getElementById('lot-desc');
const leadingPriceEl = document.getElementById('leading-price');
const leadingBidderEl = document.getElementById('leading-bidder');
const timerDisplay = document.getElementById('timer-display');
const viewersCountEl = document.getElementById('viewers-count');
const historyList = document.getElementById('history-list');
const customBidInput = document.getElementById('custom-bid-input');
const placeBidBtn = document.getElementById('place-bid-btn');
const outbidToast = document.getElementById('outbid-toast');
const auctionStatusBanner = document.getElementById('auction-status-banner');

document.getElementById('my-bidder-name').textContent = username;

// Join Auction
socket.emit('auction:join', { auctionId: currentAuctionId, username });

// Initial state hydrate
socket.on('auction:init', (data) => {
  lotTitle.textContent = data.item.title;
  lotDesc.textContent = data.item.description;
  updatePrice(data.item.currentBid, data.item.highestBidder);
  minIncrement = data.item.minIncrement;
  updateTimer(data.timeRemaining);
  updateViewers(data.totalViewers);

  historyList.innerHTML = '';
  data.bidHistory.forEach(b => appendHistoryItem(b));
  updateQuickBidButtons();
});

// Live Timer Tick
socket.on('auction:time_tick', (data) => {
  updateTimer(data.timeRemaining);
});

// Outbid alert banner (Targeted)
socket.on('bid:outbid', (data) => {
  showOutbidAlert(data.message);
});

// Bid Rejected
socket.on('bid:rejected', (data) => {
  alert(`❌ Bid Error: ${data.reason}`);
});

// Anti-Snipe Extension
socket.on('auction:extended', (data) => {
  showToast(`⚡ ${data.message}`);
  updateTimer(data.timeRemaining);
});

// Bid Success update to all viewers
socket.on('bid:success', (data) => {
  updatePrice(data.currentBid, data.highestBidder);
  updateTimer(data.timeRemaining);
  minIncrement = data.minIncrement || minIncrement;

  historyList.innerHTML = '';
  data.bidHistory.forEach(b => appendHistoryItem(b));
  updateQuickBidButtons();
});

// User Joined
socket.on('user:joined', (data) => {
  updateViewers(data.totalViewers);
});

socket.on('user:left', (data) => {
  updateViewers(data.totalViewers);
});

// Auction Sold / Concluded
socket.on('auction:sold', (data) => {
  timerDisplay.textContent = '00s';
  timerDisplay.classList.remove('urgent');
  auctionStatusBanner.style.display = 'block';
  auctionStatusBanner.innerHTML = `🔨 SOLD to <strong>${data.winner}</strong> for ₹${Number(data.finalPrice).toLocaleString('en-IN')}!`;
  
  // Disable bidding
  document.querySelectorAll('button, input').forEach(el => {
    if (el.id !== 'switch-auction-btn') el.disabled = true;
  });
});

// UI Event Handlers
function placeBid(amount) {
  socket.emit('bid:place', {
    auctionId: currentAuctionId,
    amount: Number(amount)
  });
}

placeBidBtn.addEventListener('click', () => {
  const amount = customBidInput.value.trim();
  if (amount) {
    placeBid(amount);
    customBidInput.value = '';
  }
});

customBidInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') placeBidBtn.click();
});

// Quick increment buttons
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const inc = Number(btn.getAttribute('data-increment'));
    placeBid(currentLeadingBid + inc);
  });
});

// Helpers
function updatePrice(amount, bidder) {
  currentLeadingBid = Number(amount);
  leadingPriceEl.textContent = `₹${currentLeadingBid.toLocaleString('en-IN')}`;
  leadingBidderEl.textContent = bidder || 'None';
}

function updateTimer(seconds) {
  timerDisplay.textContent = `${seconds < 10 ? '0' : ''}${seconds}s`;
  if (seconds <= 15 && seconds > 0) {
    timerDisplay.classList.add('urgent');
  } else {
    timerDisplay.classList.remove('urgent');
  }
}

function updateViewers(count) {
  viewersCountEl.textContent = `${count || 1} watching live`;
}

function updateQuickBidButtons() {
  const inc1 = minIncrement;
  const inc2 = minIncrement * 2;
  const inc3 = minIncrement * 5;

  const btns = document.querySelectorAll('.quick-btn');
  if (btns.length >= 3) {
    btns[0].textContent = `+ ₹${inc1.toLocaleString('en-IN')}`;
    btns[0].setAttribute('data-increment', inc1);

    btns[1].textContent = `+ ₹${inc2.toLocaleString('en-IN')}`;
    btns[1].setAttribute('data-increment', inc2);

    btns[2].textContent = `+ ₹${inc3.toLocaleString('en-IN')}`;
    btns[2].setAttribute('data-increment', inc3);
  }

  customBidInput.placeholder = `Min: ₹${(currentLeadingBid + minIncrement).toLocaleString('en-IN')}`;
}

function appendHistoryItem(record) {
  const div = document.createElement('div');
  div.className = 'bid-item';
  div.innerHTML = `
    <div>
      <div style="font-weight: 700; color: #fff;">${record.bidder}</div>
      <div style="font-size: 0.75rem; color: #94a3b8;">${record.timestamp}</div>
    </div>
    <div style="font-weight: 800; color: var(--gold);">₹${Number(record.amount).toLocaleString('en-IN')}</div>
  `;
  historyList.appendChild(div);
}

function showOutbidAlert(msg) {
  outbidToast.textContent = msg;
  outbidToast.style.display = 'block';
  setTimeout(() => {
    outbidToast.style.display = 'none';
  }, 5000);
}

function showToast(msg) {
  outbidToast.style.background = '#2563eb';
  outbidToast.textContent = msg;
  outbidToast.style.display = 'block';
  setTimeout(() => {
    outbidToast.style.display = 'none';
    outbidToast.style.background = '#dc2626';
  }, 4000);
}
