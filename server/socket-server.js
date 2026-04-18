import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8000;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true
}));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const waitingQueue = [];
const sessions = new Map();
const reports = [];

const publicBuildPath = path.join(appRoot, 'dist');
app.use(express.static(publicBuildPath));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    waiting: waitingQueue.length,
    activeSessions: sessions.size / 2,
    reports: reports.length
  });
});

app.get('*', (_req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  res.sendFile(path.join(publicBuildPath, 'index.html'));
});

function removeFromQueue(socketId) {
  const index = waitingQueue.indexOf(socketId);
  if (index >= 0) {
    waitingQueue.splice(index, 1);
  }
}

function getStats() {
  return {
    online: io.engine.clientsCount,
    waiting: waitingQueue.length,
    activeSessions: sessions.size / 2,
    reports: reports.length
  };
}

function broadcastStats() {
  io.emit('stats', getStats());
}

function getPartner(socketId) {
  const session = sessions.get(socketId);
  return session ? session.partnerId : null;
}

function endSession(socketId, reason = 'partner_left') {
  const session = sessions.get(socketId);
  if (!session) {
    return null;
  }

  const { partnerId, roomId } = session;
  sessions.delete(socketId);
  sessions.delete(partnerId);

  io.sockets.sockets.get(socketId)?.leave(roomId);
  const partnerSocket = io.sockets.sockets.get(partnerId);

  if (partnerSocket) {
    partnerSocket.leave(roomId);
    partnerSocket.emit('partner_disconnected', { reason });
  }

  return partnerId;
}

function tryMatch() {
  while (waitingQueue.length >= 2) {
    const firstId = waitingQueue.shift();
    const secondId = waitingQueue.shift();
    const firstSocket = io.sockets.sockets.get(firstId);
    const secondSocket = io.sockets.sockets.get(secondId);

    if (!firstSocket || !secondSocket || firstId === secondId) {
      continue;
    }

    const roomId = `room:${firstId}:${secondId}`;
    sessions.set(firstId, { partnerId: secondId, roomId });
    sessions.set(secondId, { partnerId: firstId, roomId });

    firstSocket.join(roomId);
    secondSocket.join(roomId);

    firstSocket.data.state = 'matched';
    secondSocket.data.state = 'matched';

    firstSocket.emit('matched', {
      roomId,
      partnerId: secondId,
      createOffer: true
    });
    secondSocket.emit('matched', {
      roomId,
      partnerId: firstId,
      createOffer: false
    });
  }

  waitingQueue.forEach((socketId, index) => {
    io.to(socketId).emit('queue_status', {
      position: index + 1,
      waiting: waitingQueue.length
    });
  });

  broadcastStats();
}

function forwardToPartner(socket, eventName, payload) {
  const partnerId = getPartner(socket.id);
  if (!partnerId) {
    socket.emit('server_error', { message: 'No active partner.' });
    return;
  }

  io.to(partnerId).emit(eventName, {
    ...payload,
    from: socket.id
  });
}

io.on('connection', (socket) => {
  socket.emit('server_ready', { id: socket.id });
  socket.emit('stats', getStats());
  broadcastStats();

  socket.on('join_queue', ({ interests = [] } = {}) => {
    if (sessions.has(socket.id) || waitingQueue.includes(socket.id)) {
      return;
    }

    socket.data.interests = Array.isArray(interests) ? interests.slice(0, 8) : [];
    socket.data.state = 'waiting';
    waitingQueue.push(socket.id);
    socket.emit('queue_status', {
      position: waitingQueue.length,
      waiting: waitingQueue.length
    });
    tryMatch();
  });

  socket.on('leave_queue', () => {
    removeFromQueue(socket.id);
    socket.data.state = 'idle';
    socket.emit('queue_status', { position: 0, waiting: waitingQueue.length });
    broadcastStats();
  });

  socket.on('offer', ({ offer }) => {
    forwardToPartner(socket, 'offer', { offer });
  });

  socket.on('answer', ({ answer }) => {
    forwardToPartner(socket, 'answer', { answer });
  });

  socket.on('ice_candidate', ({ candidate }) => {
    forwardToPartner(socket, 'ice_candidate', { candidate });
  });

  socket.on('chat_message', ({ message }) => {
    const cleanMessage = String(message || '').trim().slice(0, 500);
    if (!cleanMessage) {
      return;
    }

    forwardToPartner(socket, 'chat_message', {
      message: cleanMessage,
      sentAt: Date.now()
    });
  });

  socket.on('next', () => {
    removeFromQueue(socket.id);
    endSession(socket.id, 'skipped');
    socket.data.state = 'waiting';
    waitingQueue.push(socket.id);
    socket.emit('queue_status', {
      position: waitingQueue.length,
      waiting: waitingQueue.length
    });
    tryMatch();
  });

  socket.on('report', ({ reason = 'inappropriate_behavior' } = {}) => {
    const partnerId = getPartner(socket.id);
    reports.push({
      reporterId: socket.id,
      reportedId: partnerId,
      reason: String(reason).slice(0, 120),
      createdAt: new Date().toISOString()
    });

    socket.emit('report_received');
    endSession(socket.id, 'reported');
    removeFromQueue(socket.id);
    socket.data.state = 'waiting';
    waitingQueue.push(socket.id);
    tryMatch();
  });

  socket.on('leave', () => {
    removeFromQueue(socket.id);
    socket.data.state = 'idle';
    endSession(socket.id, 'partner_left');
    broadcastStats();
  });

  socket.on('disconnect', () => {
    removeFromQueue(socket.id);
    endSession(socket.id, 'partner_left');
    broadcastStats();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Incogni.tv backend listening on http://localhost:${PORT}`);
});
