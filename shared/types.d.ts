export interface Position {
    x: number;
    y: number;
}
export interface Player {
    id: string;
    name: string;
    position: Position;
    direction: 'up' | 'down' | 'left' | 'right';
    holdingItem: Item | null;
    isReady: boolean;
}
export type IngredientType = 'fish' | 'rice' | 'seaweed' | 'shrimp' | 'cucumber' | 'salmon';
export type ItemState = 'raw' | 'chopped' | 'cooked' | 'burned' | 'plated';
export interface Item {
    id: string;
    type: IngredientType;
    state: ItemState;
    cookProgress: number;
}
export interface Recipe {
    id: string;
    name: string;
    ingredients: {
        type: IngredientType;
        state: ItemState;
    }[];
    points: number;
    timeLimit: number;
}
export interface Order {
    id: string;
    recipe: Recipe;
    timeRemaining: number;
    createdAt: number;
}
export type StationType = 'counter' | 'cutting_board' | 'stove' | 'plate_station' | 'delivery' | 'ingredient_box' | 'trash';
export interface Station {
    id: string;
    type: StationType;
    position: Position;
    item: Item | null;
    cookProgress?: number;
}
export interface GameState {
    players: Map<string, Player> | Record<string, Player>;
    stations: Station[];
    orders: Order[];
    score: number;
    timeRemaining: number;
    isPlaying: boolean;
    isPaused: boolean;
}
export interface RoomInfo {
    code: string;
    players: {
        id: string;
        name: string;
        isReady: boolean;
    }[];
    hostId: string;
    isPlaying: boolean;
}
export interface ClientToServerEvents {
    'create-room': (playerName: string) => void;
    'join-room': (data: {
        code: string;
        playerName: string;
    }) => void;
    'leave-room': () => void;
    'player-ready': (isReady: boolean) => void;
    'start-game': () => void;
    'player-input': (input: PlayerInput) => void;
    'pause-game': () => void;
    'resume-game': () => void;
}
export interface ServerToClientEvents {
    'room-created': (data: {
        code: string;
        playerId: string;
    }) => void;
    'room-joined': (data: {
        room: RoomInfo;
        playerId: string;
    }) => void;
    'room-updated': (room: RoomInfo) => void;
    'player-joined': (player: {
        id: string;
        name: string;
    }) => void;
    'player-left': (playerId: string) => void;
    'game-started': (gameState: GameStateDTO) => void;
    'game-state': (gameState: GameStateDTO) => void;
    'game-over': (data: {
        score: number;
        won: boolean;
    }) => void;
    'error': (message: string) => void;
}
export interface PlayerInput {
    type: 'move' | 'interact' | 'drop';
    direction?: 'up' | 'down' | 'left' | 'right';
    timestamp: number;
}
export interface GameStateDTO {
    players: Record<string, Player>;
    stations: Station[];
    orders: Order[];
    score: number;
    timeRemaining: number;
    isPlaying: boolean;
    isPaused: boolean;
}
export interface KitchenLayout {
    width: number;
    height: number;
    tileSize: number;
    stations: StationConfig[];
    walls: Position[];
    spawnPoints: Position[];
}
export interface StationConfig {
    type: StationType;
    position: Position;
    ingredientType?: IngredientType;
}
export declare const RECIPES: Recipe[];
export declare const DEFAULT_KITCHEN: KitchenLayout;
export declare const GAME_CONSTANTS: {
    GAME_DURATION: number;
    TICK_RATE: number;
    PLAYER_SPEED: number;
    CHOP_TIME: number;
    COOK_TIME: number;
    BURN_TIME: number;
    MAX_ORDERS: number;
    ORDER_SPAWN_INTERVAL: number;
    POINTS_MULTIPLIER: number;
    TIME_BONUS_THRESHOLD: number;
    TIME_BONUS_POINTS: number;
};
//# sourceMappingURL=types.d.ts.map