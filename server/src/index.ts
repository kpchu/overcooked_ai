import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './rooms/RoomManager.js';
import { ClientToServerEvents, ServerToClientEvents, PlayerInput } from './shared/types.js';

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ 
    name: 'Cat Kitchen Game Server',
    version: '1.0.0',
    status: 'running',
    message: '🐱 Meow! The kitchen is ready!'
  });
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const roomManager = new RoomManager();

io.on('connection', (socket) => {
  console.log(`🐱 Player connected: ${socket.id}`);

  socket.on('create-room', (playerName) => {
    try {
      const { code, room } = roomManager.createRoom(socket.id, playerName);
      socket.join(code);
      socket.emit('room-created', { code, playerId: socket.id });
      console.log(`🏠 Room created: ${code} by ${playerName}`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', 'Failed to create room');
    }
  });

  socket.on('join-room', ({ code, playerName }) => {
    try {
      const room = roomManager.joinRoom(code, socket.id, playerName);
      if (!room) {
        socket.emit('error', 'Room not found or full');
        return;
      }
      
      socket.join(code);
      socket.emit('room-joined', { room, playerId: socket.id });
      socket.to(code).emit('player-joined', { id: socket.id, name: playerName });
      io.to(code).emit('room-updated', room);
      console.log(`👋 ${playerName} joined room: ${code}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', 'Failed to join room');
    }
  });

  socket.on('leave-room', () => {
    handleLeaveRoom(socket);
  });

  socket.on('player-ready', (isReady) => {
    const room = roomManager.setPlayerReady(socket.id, isReady);
    if (room) {
      io.to(room.code).emit('room-updated', room);
    }
  });

  socket.on('start-game', () => {
    const roomCode = roomManager.getPlayerRoom(socket.id);
    if (!roomCode) return;

    if (!roomManager.canStartGame(roomCode)) {
      socket.emit('error', 'Cannot start game - not all players ready');
      return;
    }

    const gameState = roomManager.startGame(
      roomCode,
      (state) => {
        io.to(roomCode).emit('game-state', state);
      },
      (score) => {
        io.to(roomCode).emit('game-over', { score, won: score > 50 });
      }
    );

    if (gameState) {
      io.to(roomCode).emit('game-started', gameState);
      console.log(`🎮 Game started in room: ${roomCode}`);
    }
  });

  socket.on('player-input', (input: PlayerInput) => {
    roomManager.handlePlayerInput(socket.id, input);
  });

  socket.on('disconnect', () => {
    console.log(`👋 Player disconnected: ${socket.id}`);
    handleLeaveRoom(socket);
  });

  function handleLeaveRoom(socket: any) {
    const result = roomManager.leaveRoom(socket.id);
    if (result) {
      socket.leave(result.roomCode);
      if (result.remainingPlayers.length > 0) {
        const room = roomManager.getRoomInfo(result.roomCode);
        if (room) {
          io.to(result.roomCode).emit('room-updated', room);
          io.to(result.roomCode).emit('player-left', socket.id);
        }
      }
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`
  🐱🍳 Cat Kitchen Server is running!
  
  Port: ${PORT}
  CORS Origin: ${CORS_ORIGIN}
  
  Ready to cook up some fun! 🎮
  `);
});
