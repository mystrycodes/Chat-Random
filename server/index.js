import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'https://localhost:3000', 'http://127.0.0.1:3000', 'https://127.0.0.1:3000', /^https?:\/\/[\d\.]+:3000$/],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = 4000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Data structures
const waitingQueue = [];
const partnerOf = new Map(); // socketID -> partnerSocketID
const roomOf = new Map();    // socketID -> roomID
const nicknames = new Map(); // socketID -> nickname
const lastMessageTime = new Map(); // socketID -> timestamp
const reportCount = new Map(); // socketID -> report count
const bannedSockets = new Set(); // Set of banned socket IDs

// Anti-spam constants
const MESSAGE_COOLDOWN = 300; // ms between messages
const MAX_MESSAGE_LENGTH = 1000; // max characters (increased for images)
const REPORTS_TO_BAN = 3; // reports needed to ban

function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function pairUsers(user1, user2) {
  const roomId = generateRoomId();
  const nickname1 = nicknames.get(user1.id) || 'Anonymous';
  const nickname2 = nicknames.get(user2.id) || 'Anonymous';

  // Join both users to the same room
  user1.join(roomId);
  user2.join(roomId);

  // Track mappings
  partnerOf.set(user1.id, user2.id);
  partnerOf.set(user2.id, user1.id);
  roomOf.set(user1.id, roomId);
  roomOf.set(user2.id, roomId);

  // Notify both users with partner's nickname
  user1.emit('matched', { roomId, partnerNickname: nickname2 });
  user2.emit('matched', { roomId, partnerNickname: nickname1 });

  console.log(`Paired ${nickname1} (${user1.id}) with ${nickname2} (${user2.id}) in room ${roomId}`);
}

// Clean up a socket from all tracking (partner, room, queue, rate limit, reports)
function cleanupSocket(socket) {
  const socketId = socket.id;
  const partnerId = partnerOf.get(socketId);
  const roomId = roomOf.get(socketId);

  // If has a partner, notify them and clean up their mappings
  if (partnerId) {
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      partnerSocket.emit('partner_left');
    }
    partnerOf.delete(partnerId);
    roomOf.delete(partnerId);
  }

  // Clean up current socket mappings
  partnerOf.delete(socketId);
  roomOf.delete(socketId);
  lastMessageTime.delete(socketId);
  reportCount.delete(socketId);

  // Leave the room if in one
  if (roomId && socket) {
    socket.leave(roomId);
  }

  console.log(`Cleaned up socket ${socketId}`);
}

// Remove from waiting queue (prevent duplicates)
function removeFromQueue(socketId) {
  const index = waitingQueue.indexOf(socketId);
  if (index > -1) {
    waitingQueue.splice(index, 1);
    console.log(`Removed ${socketId} from queue. Queue size: ${waitingQueue.length}`);
  }
}

// Add to waiting queue (prevents duplicates)
function addToQueue(socketId, socket) {
  // Prevent duplicate entries
  if (!waitingQueue.includes(socketId)) {
    waitingQueue.push(socketId);
    socket.emit('searching');
    console.log(`Added ${socketId} to queue. Queue size: ${waitingQueue.length}`);
  } else {
    socket.emit('searching');
    console.log(`${socketId} already in queue, skipped duplicate add`);
  }
}

// Try to match with someone in queue, returns true if matched
function tryMatchWithQueue(socket) {
  if (waitingQueue.length === 0) {
    return false;
  }

  // Find a valid waiting socket (one that still exists and isn't the same socket or banned)
  while (waitingQueue.length > 0) {
    const waitingSocketId = waitingQueue.shift();
    const waitingSocket = io.sockets.sockets.get(waitingSocketId);

    // Skip if this is the same socket (shouldn't happen, but safety check)
    if (waitingSocketId === socket.id) {
      continue;
    }

    // Skip banned sockets
    if (bannedSockets.has(waitingSocketId)) {
      console.log(`Skipping banned socket ${waitingSocketId}`);
      continue;
    }

    // If the waiting socket is still valid, pair them
    if (waitingSocket) {
      pairUsers(waitingSocket, socket);
      return true;
    }

    // If waiting socket no longer exists, continue looking
    console.log(`Waiting socket ${waitingSocketId} no longer exists, skipping`);
  }

  return false;
}

// Check if a socket is banned
function isBanned(socketId) {
  return bannedSockets.has(socketId);
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Check if this socket was previously banned
  if (isBanned(socket.id)) {
    socket.emit('banned');
    socket.disconnect();
    console.log(`Banned socket ${socket.id} tried to reconnect`);
    return;
  }

  // Handle "set_nickname" - Set user's nickname
  socket.on('set_nickname', (nickname) => {
    const trimmed = nickname.trim().substring(0, 20); // Max 20 chars
    nicknames.set(socket.id, trimmed || 'Anonymous');
    console.log(`Socket ${socket.id} set nickname to: ${trimmed}`);
  });

  // Handle "start" - join waiting queue or match immediately
  socket.on('start', () => {
    // Check if banned
    if (isBanned(socket.id)) {
      socket.emit('banned');
      socket.disconnect();
      return;
    }

    console.log(`User ${socket.id} requested to start`);

    // First, clean up any existing room/relationship
    cleanupSocket(socket);

    // Remove from queue if already there (prevent duplicates)
    removeFromQueue(socket.id);

    // Try to match with someone in queue
    if (!tryMatchWithQueue(socket)) {
      // No one available to match, add to queue
      addToQueue(socket.id, socket);
    }
  });

  // Handle "next" - disconnect current pair and requeue
  socket.on('next', () => {
    // Check if banned
    if (isBanned(socket.id)) {
      socket.emit('banned');
      socket.disconnect();
      return;
    }

    console.log(`User ${socket.id} requested next`);

    // Clean up current pair/room
    cleanupSocket(socket);

    // Remove from queue if present
    removeFromQueue(socket.id);

    // Try to match with someone in queue
    if (!tryMatchWithQueue(socket)) {
      // No one available, add to queue
      addToQueue(socket.id, socket);
    }
  });

  // Handle "message" - broadcast to room with anti-spam protection
  socket.on('message', (data) => {
    // Check if banned
    if (isBanned(socket.id)) {
      socket.emit('banned');
      socket.disconnect();
      return;
    }

    const roomId = roomOf.get(socket.id);
    const now = Date.now();
    const lastTime = lastMessageTime.get(socket.id) || 0;

    // Rate limit check: max 1 message per 300ms
    if (now - lastTime < MESSAGE_COOLDOWN) {
      console.log(`Rate limited: ${socket.id} tried to send message too quickly`);
      return; // Ignore message
    }

    if (roomId) {
      const nickname = nicknames.get(socket.id) || 'Anonymous';

      const message = {
        from: socket.id,
        nickname,
        text: data.text || '',
        type: data.type || 'text', // 'text' or 'image'
        image: data.image || null // base64 image data
      };

      // Message length check
      const textLength = (message.text || '').length;
      if (textLength > MAX_MESSAGE_LENGTH) {
        console.log(`Blocked: ${socket.id} sent message exceeding ${MAX_MESSAGE_LENGTH} chars`);
        return;
      }

      io.to(roomId).emit('message', message);
      lastMessageTime.set(socket.id, now);
      console.log(`Message in ${roomId} from ${nickname}: ${message.type === 'image' ? '[image]' : message.text}`);
    } else {
      console.log(`User ${socket.id} tried to send message but not in a room`);
    }
  });

  // Handle "typing" - forward typing state to partner only
  socket.on('typing', (isTyping) => {
    const partnerId = partnerOf.get(socket.id);

    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner_typing', isTyping);
      }
    }
  });

  // Handle "report" - report the current partner with reason
  socket.on('report', (reason = 'other') => {
    const partnerId = partnerOf.get(socket.id);

    if (!partnerId) {
      console.log(`User ${socket.id} tried to report but has no partner`);
      return;
    }

    const currentReports = reportCount.get(partnerId) || 0;
    reportCount.set(partnerId, currentReports + 1);

    const partnerNickname = nicknames.get(partnerId) || 'Anonymous';
    console.log(`Socket ${socket.id} reported ${partnerNickname} (${partnerId}) - Reason: ${reason} (${currentReports + 1}/${REPORTS_TO_BAN} reports)`);

    // Notify reporter
    socket.emit('report_submitted', { count: currentReports + 1, reason });

    // Check if partner should be banned
    if (currentReports + 1 >= REPORTS_TO_BAN) {
      bannedSockets.add(partnerId);
      console.log(`Socket ${partnerNickname} (${partnerId}) has been banned!`);

      // Disconnect the banned partner
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('banned');
        partnerSocket.disconnect();
      }

      // Notify the reporter that partner was banned
      socket.emit('partner_banned', { nickname: partnerNickname });

      // Clean up the partner
      cleanupSocket({ id: partnerId });
    }
  });

  // Handle WebRTC signaling - Forward offer to partner
  socket.on('webrtc_offer', (data) => {
    const partnerId = partnerOf.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('webrtc_offer', { offer: data.offer, from: socket.id });
        console.log(`Forwarded WebRTC offer from ${socket.id} to ${partnerId}`);
      }
    }
  });

  // Handle WebRTC signaling - Forward answer to partner
  socket.on('webrtc_answer', (data) => {
    const partnerId = partnerOf.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('webrtc_answer', { answer: data.answer, from: socket.id });
        console.log(`Forwarded WebRTC answer from ${socket.id} to ${partnerId}`);
      }
    }
  });

  // Handle WebRTC signaling - Forward ICE candidates to partner
  socket.on('webrtc_ice_candidate', (data) => {
    const partnerId = partnerOf.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('webrtc_ice_candidate', { candidate: data.candidate, from: socket.id });
        console.log(`Forwarded ICE candidate from ${socket.id} to ${partnerId}`);
      }
    }
  });

  // Handle video call request from caller
  socket.on('video_call_request', () => {
    const partnerId = partnerOf.get(socket.id);
    if (partnerId) {
      const nickname = nicknames.get(socket.id) || 'Anonymous';
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('incoming_video_call', { from: socket.id, nickname });
        console.log(`Video call request from ${socket.id} (${nickname}) to ${partnerId}`);
      }
    }
  });

  // Handle video call response (accept/reject)
  socket.on('video_call_response', (data) => {
    const partnerId = partnerOf.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('video_call_response', { accepted: data.accepted, from: socket.id });
        console.log(`Video call response from ${socket.id}: ${data.accepted ? 'accepted' : 'rejected'}`);
      }
    }
  });

  // Handle video call end
  socket.on('video_call_end', () => {
    const partnerId = partnerOf.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('video_call_ended');
        console.log(`Video call ended by ${socket.id}`);
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    // Remove from waiting queue if present
    removeFromQueue(socket.id);

    // Clean up partner relationship and notify partner
    cleanupSocket(socket);

    // Clean up nickname
    nicknames.delete(socket.id);
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Random chat server running on http://localhost:${PORT}`);
  console.log(`Access from mobile: http://<YOUR_IP>:${PORT}`);
});
