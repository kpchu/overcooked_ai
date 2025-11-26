import { v4 as uuidv4 } from 'uuid';
import {
  Player,
  RoomInfo,
  GameState,
  GameStateDTO,
  Station,
  Order,
  DEFAULT_KITCHEN,
  GAME_CONSTANTS,
  RECIPES,
  Item,
  IngredientType,
  PlayerInput,
} from '../shared/types.js';

interface GameRoom {
  code: string;
  players: Map<string, Player>;
  hostId: string;
  gameState: GameState | null;
  gameLoop: NodeJS.Timeout | null;
  orderSpawnLoop: NodeJS.Timeout | null;
  createdAt: number;
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerRooms: Map<string, string> = new Map(); // playerId -> roomCode

  constructor() {
    // Cleanup stale rooms every minute
    setInterval(() => this.cleanupStaleRooms(), 60000);
  }

  generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Ensure unique
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }

  createRoom(playerId: string, playerName: string): { code: string; room: RoomInfo } {
    const code = this.generateRoomCode();
    
    const player: Player = {
      id: playerId,
      name: playerName,
      position: { ...DEFAULT_KITCHEN.spawnPoints[0] },
      direction: 'down',
      holdingItem: null,
      isReady: false,
    };

    const room: GameRoom = {
      code,
      players: new Map([[playerId, player]]),
      hostId: playerId,
      gameState: null,
      gameLoop: null,
      orderSpawnLoop: null,
      createdAt: Date.now(),
    };

    this.rooms.set(code, room);
    this.playerRooms.set(playerId, code);

    return { code, room: this.getRoomInfo(code)! };
  }

  joinRoom(code: string, playerId: string, playerName: string): RoomInfo | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    if (room.players.size >= 2) return null;
    if (room.gameState?.isPlaying) return null;

    const spawnIndex = room.players.size;
    const player: Player = {
      id: playerId,
      name: playerName,
      position: { ...DEFAULT_KITCHEN.spawnPoints[spawnIndex] },
      direction: 'down',
      holdingItem: null,
      isReady: false,
    };

    room.players.set(playerId, player);
    this.playerRooms.set(playerId, code.toUpperCase());

    return this.getRoomInfo(code.toUpperCase());
  }

  leaveRoom(playerId: string): { roomCode: string; remainingPlayers: string[] } | null {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.players.delete(playerId);
    this.playerRooms.delete(playerId);

    // Stop game if running
    if (room.gameLoop) {
      clearInterval(room.gameLoop);
      room.gameLoop = null;
    }
    if (room.orderSpawnLoop) {
      clearInterval(room.orderSpawnLoop);
      room.orderSpawnLoop = null;
    }

    const remainingPlayers = Array.from(room.players.keys());

    // Delete room if empty
    if (room.players.size === 0) {
      this.rooms.delete(roomCode);
      return { roomCode, remainingPlayers: [] };
    }

    // Transfer host if needed
    if (room.hostId === playerId) {
      room.hostId = remainingPlayers[0];
    }

    return { roomCode, remainingPlayers };
  }

  setPlayerReady(playerId: string, isReady: boolean): RoomInfo | null {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.get(playerId);
    if (player) {
      player.isReady = isReady;
    }

    return this.getRoomInfo(roomCode);
  }

  canStartGame(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    // Allow single player mode - just need at least 1 player
    if (room.players.size < 1) return false;
    
    for (const player of room.players.values()) {
      if (!player.isReady) return false;
    }
    return true;
  }

  startGame(roomCode: string, onGameUpdate: (state: GameStateDTO) => void, onGameOver: (score: number) => void): GameStateDTO | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    // Initialize stations
    const stations: Station[] = DEFAULT_KITCHEN.stations.map((config, index) => ({
      id: `station_${index}`,
      type: config.type,
      position: { ...config.position },
      item: null,
      cookProgress: 0,
    }));

    // Reset player positions
    let spawnIndex = 0;
    for (const player of room.players.values()) {
      player.position = { ...DEFAULT_KITCHEN.spawnPoints[spawnIndex] };
      player.direction = 'down';
      player.holdingItem = null;
      player.isReady = false;
      spawnIndex++;
    }

    // Create initial orders
    const orders: Order[] = [this.createOrder()];

    const gameState: GameState = {
      players: room.players,
      stations,
      orders,
      score: 0,
      timeRemaining: GAME_CONSTANTS.GAME_DURATION,
      isPlaying: true,
      isPaused: false,
    };

    room.gameState = gameState;

    // Start game loop
    room.gameLoop = setInterval(() => {
      if (!room.gameState || !room.gameState.isPlaying || room.gameState.isPaused) return;

      // Update cooking progress
      this.updateCooking(room);

      // Update time
      room.gameState.timeRemaining -= 1 / GAME_CONSTANTS.TICK_RATE;

      // Check game over
      if (room.gameState.timeRemaining <= 0) {
        room.gameState.isPlaying = false;
        if (room.gameLoop) clearInterval(room.gameLoop);
        if (room.orderSpawnLoop) clearInterval(room.orderSpawnLoop);
        onGameOver(room.gameState.score);
        return;
      }

      // Update order timers
      for (const order of room.gameState.orders) {
        order.timeRemaining -= 1 / GAME_CONSTANTS.TICK_RATE;
        if (order.timeRemaining <= 0) {
          // Order expired, remove it
          room.gameState.orders = room.gameState.orders.filter(o => o.id !== order.id);
        }
      }

      onGameUpdate(this.getGameStateDTO(room));
    }, 1000 / GAME_CONSTANTS.TICK_RATE);

    // Spawn orders periodically
    room.orderSpawnLoop = setInterval(() => {
      if (!room.gameState || !room.gameState.isPlaying) return;
      if (room.gameState.orders.length < GAME_CONSTANTS.MAX_ORDERS) {
        room.gameState.orders.push(this.createOrder());
      }
    }, GAME_CONSTANTS.ORDER_SPAWN_INTERVAL);

    return this.getGameStateDTO(room);
  }

  private createOrder(): Order {
    const recipe = RECIPES[Math.floor(Math.random() * RECIPES.length)];
    return {
      id: uuidv4(),
      recipe,
      timeRemaining: recipe.timeLimit,
      createdAt: Date.now(),
    };
  }

  private updateCooking(room: GameRoom): void {
    if (!room.gameState) return;

    for (const station of room.gameState.stations) {
      if (station.type === 'stove' && station.item) {
        const currentState = station.item.state;
        
        if (currentState === 'raw' || currentState === 'chopped') {
          station.item.cookProgress += (100 / (GAME_CONSTANTS.COOK_TIME / 1000)) / GAME_CONSTANTS.TICK_RATE;
          
          if (station.item.cookProgress >= 100) {
            station.item.state = 'cooked';
            station.item.cookProgress = 0;
          }
        } else if (currentState === 'cooked') {
          station.item.cookProgress += (100 / (GAME_CONSTANTS.BURN_TIME / 1000)) / GAME_CONSTANTS.TICK_RATE;
          if (station.item.cookProgress >= 100) {
            station.item.state = 'burned';
          }
        }
      }
    }
  }

  handlePlayerInput(playerId: string, input: PlayerInput): void {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (!room || !room.gameState || !room.gameState.isPlaying) return;

    const player = room.players.get(playerId);
    if (!player) return;

    switch (input.type) {
      case 'move':
        this.handleMove(player, input.direction!, room);
        break;
      case 'interact':
        this.handleInteract(player, room);
        break;
      case 'drop':
        this.handleDrop(player, room);
        break;
    }
  }

  private handleMove(player: Player, direction: 'up' | 'down' | 'left' | 'right', room: GameRoom): void {
    const speed = GAME_CONSTANTS.PLAYER_SPEED / GAME_CONSTANTS.TICK_RATE;
    let newX = player.position.x;
    let newY = player.position.y;

    switch (direction) {
      case 'up': newY -= speed; break;
      case 'down': newY += speed; break;
      case 'left': newX -= speed; break;
      case 'right': newX += speed; break;
    }

    player.direction = direction;

    // Check bounds
    if (newX < 0.5 || newX > DEFAULT_KITCHEN.width - 0.5) return;
    if (newY < 0.5 || newY > DEFAULT_KITCHEN.height - 0.5) return;

    // Check collision with stations
    for (const station of room.gameState!.stations) {
      const dx = Math.abs(newX - station.position.x - 0.5);
      const dy = Math.abs(newY - station.position.y - 0.5);
      if (dx < 0.8 && dy < 0.8) {
        return; // Collision
      }
    }

    player.position.x = newX;
    player.position.y = newY;
  }

  private handleInteract(player: Player, room: GameRoom): void {
    // Find nearest station
    const station = this.getNearestStation(player, room);
    console.log(`🎮 Player ${player.name} interacting, nearest station:`, station?.type, 'holding:', player.holdingItem?.type);
    if (!station) {
      console.log(`❌ No station found near player at (${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}) facing ${player.direction}`);
      return;
    }

    if (station.type === 'ingredient_box') {
      // Pick up ingredient
      if (!player.holdingItem) {
        const stationConfig = DEFAULT_KITCHEN.stations.find(
          s => s.position.x === station.position.x && s.position.y === station.position.y
        );
        if (stationConfig?.ingredientType) {
          player.holdingItem = {
            id: uuidv4(),
            type: stationConfig.ingredientType,
            state: 'raw',
            cookProgress: 0,
          };
        }
      }
    } else if (station.type === 'cutting_board') {
      if (player.holdingItem && player.holdingItem.state === 'raw') {
        // Start chopping (instant for simplicity)
        player.holdingItem.state = 'chopped';
      }
    } else if (station.type === 'stove') {
      if (player.holdingItem && !station.item) {
        // Place item on stove
        station.item = player.holdingItem;
        player.holdingItem = null;
      } else if (!player.holdingItem && station.item) {
        // Pick up from stove
        player.holdingItem = station.item;
        station.item = null;
      }
    } else if (station.type === 'counter') {
      if (player.holdingItem && !station.item) {
        station.item = player.holdingItem;
        player.holdingItem = null;
      } else if (!player.holdingItem && station.item) {
        player.holdingItem = station.item;
        station.item = null;
      }
    } else if (station.type === 'plate_station') {
      if (player.holdingItem) {
        // Try to plate the item
        player.holdingItem.state = 'plated';
      }
    } else if (station.type === 'delivery') {
      if (player.holdingItem && player.holdingItem.state === 'plated') {
        // Check if matches any order
        const matchedOrder = this.findMatchingOrder(player.holdingItem, room);
        if (matchedOrder) {
          room.gameState!.score += matchedOrder.recipe.points;
          room.gameState!.orders = room.gameState!.orders.filter(o => o.id !== matchedOrder.id);
          player.holdingItem = null;
        }
      }
    } else if (station.type === 'trash') {
      player.holdingItem = null;
    }
  }

  private handleDrop(player: Player, room: GameRoom): void {
    const station = this.getNearestStation(player, room);
    if (station && !station.item && player.holdingItem) {
      if (station.type === 'counter' || station.type === 'cutting_board' || station.type === 'stove') {
        station.item = player.holdingItem;
        player.holdingItem = null;
      }
    }
  }

  private getNearestStation(player: Player, room: GameRoom): Station | null {
    let nearest: Station | null = null;
    let minDist = 1.8; // Max interaction distance (increased)

    for (const station of room.gameState!.stations) {
      const dx = player.position.x - (station.position.x + 0.5);
      const dy = player.position.y - (station.position.y + 0.5);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist) {
        minDist = dist;
        nearest = station;
      }
    }

    return nearest;
  }

  private findMatchingOrder(item: Item, room: GameRoom): Order | null {
    // Simple matching - just check ingredient type for now
    for (const order of room.gameState!.orders) {
      const requiredTypes = order.recipe.ingredients.map(i => i.type);
      if (requiredTypes.includes(item.type)) {
        return order;
      }
    }
    return null;
  }

  getRoomInfo(code: string): RoomInfo | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;

    return {
      code: room.code,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isReady: p.isReady,
      })),
      hostId: room.hostId,
      isPlaying: room.gameState?.isPlaying ?? false,
    };
  }

  getGameStateDTO(room: GameRoom): GameStateDTO {
    const playersObj: Record<string, Player> = {};
    for (const [id, player] of room.players) {
      playersObj[id] = player;
    }

    return {
      players: playersObj,
      stations: room.gameState!.stations,
      orders: room.gameState!.orders,
      score: room.gameState!.score,
      timeRemaining: room.gameState!.timeRemaining,
      isPlaying: room.gameState!.isPlaying,
      isPaused: room.gameState!.isPaused,
    };
  }

  getPlayerRoom(playerId: string): string | undefined {
    return this.playerRooms.get(playerId);
  }

  private cleanupStaleRooms(): void {
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours

    for (const [code, room] of this.rooms) {
      if (room.players.size === 0 || now - room.createdAt > maxAge) {
        if (room.gameLoop) clearInterval(room.gameLoop);
        if (room.orderSpawnLoop) clearInterval(room.orderSpawnLoop);
        this.rooms.delete(code);
        console.log(`Cleaned up room: ${code}`);
      }
    }
  }
}
