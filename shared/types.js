// Shared types between client and server
// Recipes
export const RECIPES = [
    {
        id: 'sushi_roll',
        name: 'Sushi Roll',
        ingredients: [
            { type: 'fish', state: 'chopped' },
            { type: 'rice', state: 'cooked' },
            { type: 'seaweed', state: 'raw' },
        ],
        points: 30,
        timeLimit: 60,
    },
    {
        id: 'shrimp_nigiri',
        name: 'Shrimp Nigiri',
        ingredients: [
            { type: 'shrimp', state: 'cooked' },
            { type: 'rice', state: 'cooked' },
        ],
        points: 20,
        timeLimit: 45,
    },
    {
        id: 'salmon_sashimi',
        name: 'Salmon Sashimi',
        ingredients: [
            { type: 'salmon', state: 'chopped' },
        ],
        points: 15,
        timeLimit: 30,
    },
    {
        id: 'cucumber_roll',
        name: 'Cucumber Roll',
        ingredients: [
            { type: 'cucumber', state: 'chopped' },
            { type: 'rice', state: 'cooked' },
            { type: 'seaweed', state: 'raw' },
        ],
        points: 25,
        timeLimit: 50,
    },
];
// Default kitchen layout
export const DEFAULT_KITCHEN = {
    width: 12,
    height: 8,
    tileSize: 64,
    stations: [
        // Ingredient boxes (top row)
        { type: 'ingredient_box', position: { x: 1, y: 0 }, ingredientType: 'fish' },
        { type: 'ingredient_box', position: { x: 2, y: 0 }, ingredientType: 'rice' },
        { type: 'ingredient_box', position: { x: 3, y: 0 }, ingredientType: 'seaweed' },
        { type: 'ingredient_box', position: { x: 4, y: 0 }, ingredientType: 'shrimp' },
        { type: 'ingredient_box', position: { x: 5, y: 0 }, ingredientType: 'salmon' },
        { type: 'ingredient_box', position: { x: 6, y: 0 }, ingredientType: 'cucumber' },
        // Cutting boards (left side)
        { type: 'cutting_board', position: { x: 0, y: 2 } },
        { type: 'cutting_board', position: { x: 0, y: 3 } },
        // Stoves (right side)
        { type: 'stove', position: { x: 11, y: 2 } },
        { type: 'stove', position: { x: 11, y: 3 } },
        // Counters (middle area)
        { type: 'counter', position: { x: 4, y: 3 } },
        { type: 'counter', position: { x: 5, y: 3 } },
        { type: 'counter', position: { x: 6, y: 3 } },
        { type: 'counter', position: { x: 7, y: 3 } },
        { type: 'counter', position: { x: 4, y: 4 } },
        { type: 'counter', position: { x: 5, y: 4 } },
        { type: 'counter', position: { x: 6, y: 4 } },
        { type: 'counter', position: { x: 7, y: 4 } },
        // Plate station
        { type: 'plate_station', position: { x: 9, y: 5 } },
        { type: 'plate_station', position: { x: 10, y: 5 } },
        // Delivery window (bottom)
        { type: 'delivery', position: { x: 5, y: 7 } },
        { type: 'delivery', position: { x: 6, y: 7 } },
        // Trash
        { type: 'trash', position: { x: 0, y: 7 } },
    ],
    walls: [
    // Border walls handled separately
    ],
    spawnPoints: [
        { x: 3, y: 5 },
        { x: 8, y: 5 },
    ],
};
// Game constants
export const GAME_CONSTANTS = {
    GAME_DURATION: 180, // 3 minutes
    TICK_RATE: 20, // Server updates per second
    PLAYER_SPEED: 5,
    CHOP_TIME: 3000, // ms
    COOK_TIME: 5000, // ms
    BURN_TIME: 8000, // ms after cooked
    MAX_ORDERS: 4,
    ORDER_SPAWN_INTERVAL: 15000, // ms
    POINTS_MULTIPLIER: 1,
    TIME_BONUS_THRESHOLD: 10, // seconds remaining for bonus
    TIME_BONUS_POINTS: 5,
};
//# sourceMappingURL=types.js.map