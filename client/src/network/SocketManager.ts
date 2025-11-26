import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomInfo,
  GameStateDTO,
  PlayerInput,
} from '../shared/types';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class SocketManager {
  private socket: GameSocket | null = null;
  private serverUrl: string;

  // Event callbacks
  public onRoomCreated: ((data: { code: string; playerId: string }) => void) | null = null;
  public onRoomJoined: ((data: { room: RoomInfo; playerId: string }) => void) | null = null;
  public onRoomUpdated: ((room: RoomInfo) => void) | null = null;
  public onPlayerJoined: ((player: { id: string; name: string }) => void) | null = null;
  public onPlayerLeft: ((playerId: string) => void) | null = null;
  public onGameStarted: ((gameState: GameStateDTO) => void) | null = null;
  public onGameState: ((gameState: GameStateDTO) => void) | null = null;
  public onGameOver: ((data: { score: number; won: boolean }) => void) | null = null;
  public onError: ((message: string) => void) | null = null;
  public onConnect: (() => void) | null = null;
  public onDisconnect: (() => void) | null = null;

  constructor() {
    // Use environment variable or default to localhost
    this.serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('🐱 Connected to server!');
        this.onConnect?.();
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('😿 Disconnected from server');
        this.onDisconnect?.();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      // Room events
      this.socket.on('room-created', (data) => {
        this.onRoomCreated?.(data);
      });

      this.socket.on('room-joined', (data) => {
        this.onRoomJoined?.(data);
      });

      this.socket.on('room-updated', (room) => {
        this.onRoomUpdated?.(room);
      });

      this.socket.on('player-joined', (player) => {
        this.onPlayerJoined?.(player);
      });

      this.socket.on('player-left', (playerId) => {
        this.onPlayerLeft?.(playerId);
      });

      // Game events
      this.socket.on('game-started', (gameState) => {
        console.log('📡 Socket received game-started event:', gameState);
        this.onGameStarted?.(gameState);
      });

      this.socket.on('game-state', (gameState) => {
        this.onGameState?.(gameState);
      });

      this.socket.on('game-over', (data) => {
        this.onGameOver?.(data);
      });

      this.socket.on('error', (message) => {
        console.error('Server error:', message);
        this.onError?.(message);
      });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  createRoom(playerName: string): void {
    this.socket?.emit('create-room', playerName);
  }

  joinRoom(code: string, playerName: string): void {
    this.socket?.emit('join-room', { code, playerName });
  }

  leaveRoom(): void {
    this.socket?.emit('leave-room');
  }

  setReady(isReady: boolean): void {
    this.socket?.emit('player-ready', isReady);
  }

  startGame(): void {
    this.socket?.emit('start-game');
  }

  sendInput(input: PlayerInput): void {
    this.socket?.emit('player-input', input);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get socketId(): string | undefined {
    return this.socket?.id;
  }
}

// Singleton instance
export const socketManager = new SocketManager();
