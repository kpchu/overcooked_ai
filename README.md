# 🐱 Cat Kitchen - Multiplayer Cooking Game

A real-time multiplayer cooking game inspired by Overcooked, featuring adorable cat characters! Built with Phaser.js for the game client and Socket.io for real-time multiplayer communication.

## 🎮 Features

- **Real-time 2-player co-op**: Play with a friend over the internet
- **Room-based matchmaking**: Create or join rooms using 6-character codes
- **Cat-themed characters**: Cute cat chefs cooking delicious sushi dishes
- **Interactive kitchen**: Pick up ingredients, chop, cook, plate, and deliver orders
- **Order system**: Complete recipes before time runs out to earn points
- **No database required**: All game state is managed in-memory

## 🍣 Game Mechanics

- **Ingredients**: Fish, Rice, Seaweed, Shrimp, Salmon, Cucumber
- **Stations**: 
  - 🥬 Ingredient Boxes - Pick up raw ingredients
  - 🔪 Cutting Board - Chop ingredients
  - 🔥 Stove - Cook ingredients (watch for burning!)
  - 📦 Counter - Temporary storage
  - 🍽️ Plate Station - Plate finished dishes
  - 📤 Delivery Window - Serve completed orders
  - 🗑️ Trash - Discard unwanted items

## 🕹️ Controls

- **WASD / Arrow Keys**: Move your cat chef
- **SPACE**: Interact (pick up, use station)
- **E**: Drop item

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd overcooked_ai
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Start the server** (in one terminal)
   ```bash
   cd server
   npm run dev
   ```
   Server runs on http://localhost:3001

5. **Start the client** (in another terminal)
   ```bash
   cd client
   npm run dev
   ```
   Client runs on http://localhost:3000

6. **Open the game**
   - Open http://localhost:3000 in your browser
   - Create a room and share the code with a friend
   - Both players mark ready, and the host starts the game!

## 📦 Deployment to Render

### Backend (Web Service)

1. Create a new **Web Service** on Render
2. Connect your GitHub repository
3. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `PORT`: `10000` (Render provides this automatically)
     - `CORS_ORIGIN`: `https://your-frontend-url.onrender.com`

### Frontend (Static Site)

1. Create a new **Static Site** on Render
2. Connect your GitHub repository
3. Configure:
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Environment Variables**:
     - `VITE_SERVER_URL`: `https://your-backend-url.onrender.com`

### Using render.yaml (Blueprint)

Alternatively, use the `render.yaml` file in the root for automatic deployment:

```bash
# render.yaml is already configured
# Just connect your repo to Render and it will auto-detect the blueprint
```

## 🏗️ Project Structure

```
overcooked_ai/
├── client/                  # Frontend (Phaser.js + Vite)
│   ├── src/
│   │   ├── main.ts         # Game entry point
│   │   ├── scenes/         # Phaser scenes
│   │   │   ├── MenuScene.ts
│   │   │   ├── LobbyScene.ts
│   │   │   ├── GameScene.ts
│   │   │   └── GameOverScene.ts
│   │   └── network/
│   │       └── SocketManager.ts
│   ├── index.html
│   └── package.json
│
├── server/                  # Backend (Node.js + Socket.io)
│   ├── src/
│   │   ├── index.ts        # Server entry point
│   │   └── rooms/
│   │       └── RoomManager.ts
│   └── package.json
│
├── shared/                  # Shared types
│   └── types.ts
│
├── render.yaml             # Render deployment config
└── README.md
```

## 🛠️ Tech Stack

- **Frontend**: Phaser.js 3, TypeScript, Vite, Socket.io-client
- **Backend**: Node.js, Express, Socket.io, TypeScript
- **Deployment**: Render (Static Site + Web Service)

## 🐱 Credits

Made with 💕 and lots of 🐱

---

Enjoy cooking with your friends! 🍳🐱
