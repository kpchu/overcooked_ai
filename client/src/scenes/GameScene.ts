import Phaser from 'phaser';
import { socketManager } from '../network/SocketManager';
import { TouchControls } from '../ui/TouchControls';
import {
  GameStateDTO,
  Player,
  Station,
  Order,
  DEFAULT_KITCHEN,
  GAME_CONSTANTS,
  IngredientType,
  ItemState,
} from '../shared/types';

interface GameSceneData {
  playerId: string;
  playerName: string;
  roomCode: string;
  initialState: GameStateDTO;
}

export class GameScene extends Phaser.Scene {
  private playerId: string = '';
  private playerName: string = '';
  private roomCode: string = '';
  private gameState: GameStateDTO | null = null;

  // Graphics
  private playerSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private stationSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private itemSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();

  // UI
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private ordersContainer!: Phaser.GameObjects.Container;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;
  private lastInputTime: number = 0;
  private inputThrottle: number = 50; // ms
  
  // Touch controls
  private touchControls: TouchControls | null = null;
  private isTouchDevice: boolean = false;
  private lastInteractTime: number = 0;
  private lastDropTime: number = 0;

  // Kitchen dimensions
  private tileSize: number = 64;
  private offsetX: number = 50;
  private offsetY: number = 100;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneData) {
    this.playerId = data.playerId;
    this.playerName = data.playerName;
    this.roomCode = data.roomCode;
    this.gameState = data.initialState;
  }

  create() {
    try {
      console.log('🎮 GameScene create() called!', this.gameState);

      // Check if touch device
      this.isTouchDevice = TouchControls.isTouchDevice();
      console.log('📱 Touch device:', this.isTouchDevice);

      // Background
      this.cameras.main.setBackgroundColor('#f5f5dc');

      // Draw kitchen
      this.drawKitchen();

      // Create UI first (before updateGameDisplay needs it)
      this.createUI();

      // Setup input (keyboard)
      this.setupInput();
      
      // Setup touch controls for mobile
      if (this.isTouchDevice) {
        this.touchControls = new TouchControls(this);
      }

      // Setup socket callbacks
      this.setupSocketCallbacks();

      // Draw initial game state (after UI is created)
      if (this.gameState) {
        this.updateGameDisplay(this.gameState);
      }
      
      console.log('🎮 GameScene create() completed successfully!');
    } catch (error) {
      console.error('🚨 GameScene create() error:', error);
    }
  }

  private drawKitchen() {
    // Draw floor tiles
    for (let x = 0; x < DEFAULT_KITCHEN.width; x++) {
      for (let y = 0; y < DEFAULT_KITCHEN.height; y++) {
        const tileX = this.offsetX + x * this.tileSize;
        const tileY = this.offsetY + y * this.tileSize;

        // Checkerboard floor pattern
        const color = (x + y) % 2 === 0 ? 0xffe4c4 : 0xffdab9;
        this.add.rectangle(tileX + this.tileSize / 2, tileY + this.tileSize / 2, 
                          this.tileSize - 2, this.tileSize - 2, color);
      }
    }

    // Draw stations
    for (const stationConfig of DEFAULT_KITCHEN.stations) {
      const container = this.createStationSprite(stationConfig.type, stationConfig.position.x, stationConfig.position.y);
      this.stationSprites.set(`station_${DEFAULT_KITCHEN.stations.indexOf(stationConfig)}`, container);
    }
  }

  private createStationSprite(type: string, gridX: number, gridY: number): Phaser.GameObjects.Container {
    const x = this.offsetX + gridX * this.tileSize + this.tileSize / 2;
    const y = this.offsetY + gridY * this.tileSize + this.tileSize / 2;

    const container = this.add.container(x, y);

    // Station background
    let bgColor = 0x8b4513;
    let emoji = '📦';

    switch (type) {
      case 'ingredient_box':
        bgColor = 0x90ee90;
        emoji = '🥬';
        break;
      case 'cutting_board':
        bgColor = 0xdeb887;
        emoji = '🔪';
        break;
      case 'stove':
        bgColor = 0xff6347;
        emoji = '🔥';
        break;
      case 'counter':
        bgColor = 0xd2b48c;
        emoji = '📦';
        break;
      case 'plate_station':
        bgColor = 0xffffff;
        emoji = '🍽️';
        break;
      case 'delivery':
        bgColor = 0x98fb98;
        emoji = '📤';
        break;
      case 'trash':
        bgColor = 0x808080;
        emoji = '🗑️';
        break;
    }

    const bg = this.add.rectangle(0, 0, this.tileSize - 4, this.tileSize - 4, bgColor);
    bg.setStrokeStyle(2, 0x5a4a3a);
    container.add(bg);

    const icon = this.add.text(0, 0, emoji, { fontSize: '28px' }).setOrigin(0.5);
    container.add(icon);

    return container;
  }

  private createPlayerSprite(player: Player): Phaser.GameObjects.Container {
    const x = this.offsetX + player.position.x * this.tileSize;
    const y = this.offsetY + player.position.y * this.tileSize;

    const container = this.add.container(x, y);

    // Cat body
    const catEmoji = player.id === this.playerId ? '😺' : '😸';
    const cat = this.add.text(0, 0, catEmoji, { fontSize: '40px' }).setOrigin(0.5);
    container.add(cat);

    // Player name
    const name = this.add.text(0, -35, player.name, {
      fontSize: '12px',
      fontFamily: 'Fredoka',
      color: player.id === this.playerId ? '#ff6b6b' : '#4ecdc4',
      backgroundColor: '#fff',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
    container.add(name);

    // Holding item indicator
    if (player.holdingItem) {
      const itemEmoji = this.getItemEmoji(player.holdingItem.type, player.holdingItem.state);
      const item = this.add.text(20, -10, itemEmoji, { fontSize: '24px' }).setOrigin(0.5);
      container.add(item);
    }

    container.setDepth(10);
    return container;
  }

  private getItemEmoji(type: IngredientType, state: ItemState): string {
    const items: Record<IngredientType, Record<ItemState, string>> = {
      fish: { raw: '🐟', chopped: '🍣', cooked: '🍥', burned: '💀', plated: '🍣' },
      rice: { raw: '🍚', chopped: '🍚', cooked: '🍙', burned: '💀', plated: '🍙' },
      seaweed: { raw: '🥬', chopped: '🥬', cooked: '🥬', burned: '💀', plated: '🥬' },
      shrimp: { raw: '🦐', chopped: '🦐', cooked: '🍤', burned: '💀', plated: '🍤' },
      salmon: { raw: '🐠', chopped: '🍣', cooked: '🍣', burned: '💀', plated: '🍣' },
      cucumber: { raw: '🥒', chopped: '🥒', cooked: '🥒', burned: '💀', plated: '🥒' },
    };
    return items[type]?.[state] || '❓';
  }

  private createUI() {
    const { width } = this.cameras.main;

    // Score
    this.scoreText = this.add.text(20, 20, 'Score: 0', {
      fontSize: '24px',
      fontFamily: 'Fredoka',
      color: '#5a4a3a',
    });

    // Timer
    this.timerText = this.add.text(width - 20, 20, 'Time: 3:00', {
      fontSize: '24px',
      fontFamily: 'Fredoka',
      color: '#5a4a3a',
    }).setOrigin(1, 0);

    // Room code
    this.add.text(width / 2, 20, `Room: ${this.roomCode}`, {
      fontSize: '16px',
      fontFamily: 'Fredoka',
      color: '#8b7355',
    }).setOrigin(0.5, 0);

    // Orders container
    this.ordersContainer = this.add.container(width - 200, 80);
    this.add.text(width - 200, 60, '📝 Orders:', {
      fontSize: '18px',
      fontFamily: 'Fredoka',
      color: '#5a4a3a',
    });

    // Controls hint
    this.add.text(20, this.cameras.main.height - 30, 'WASD: Move | SPACE: Interact | E: Drop | Click here for keyboard focus!', {
      fontSize: '14px',
      fontFamily: 'Fredoka',
      color: '#8b7355',
    });

    // Make sure the game canvas can receive keyboard input
    this.input.on('pointerdown', () => {
      this.game.canvas.focus();
    });
    
    // Focus the canvas on scene start
    this.game.canvas.setAttribute('tabindex', '1');
    this.game.canvas.focus();
  }

  private setupInput() {
    if (!this.input.keyboard) return;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  private setupSocketCallbacks() {
    socketManager.onGameState = (state) => {
      console.log('📡 Received game state update');
      this.gameState = state;
      this.updateGameDisplay(state);
    };

    socketManager.onGameOver = (data) => {
      this.scene.start('GameOverScene', {
        score: data.score,
        won: data.won,
        roomCode: this.roomCode,
      });
    };

    socketManager.onPlayerLeft = () => {
      // Show message that partner left
      const { width, height } = this.cameras.main;
      this.add.text(width / 2, height / 2, '😿 Your partner left!\nReturning to menu...', {
        fontSize: '24px',
        fontFamily: 'Fredoka',
        color: '#e74c3c',
        align: 'center',
        backgroundColor: '#fff',
        padding: { x: 20, y: 20 },
      }).setOrigin(0.5);

      this.time.delayedCall(3000, () => {
        this.scene.start('MenuScene');
      });
    };
  }

  update(time: number) {
    // Handle keyboard input
    if (this.cursors && this.wasd) {
      this.handleKeyboardInput(time);
    }
    
    // Handle touch input
    if (this.touchControls) {
      this.handleTouchInput(time);
    }
  }

  private handleKeyboardInput(time: number) {
    if (time - this.lastInputTime < this.inputThrottle) return;
    if (!this.cursors || !this.wasd || !this.spaceKey || !this.eKey) return;

    // Movement
    let direction: 'up' | 'down' | 'left' | 'right' | null = null;

    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      direction = 'up';
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      direction = 'down';
    } else if (this.cursors.left.isDown || this.wasd.A.isDown) {
      direction = 'left';
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      direction = 'right';
    }

    if (direction) {
      socketManager.sendInput({
        type: 'move',
        direction,
        timestamp: Date.now(),
      });
      this.lastInputTime = time;
    }

    // Interact
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      socketManager.sendInput({
        type: 'interact',
        timestamp: Date.now(),
      });
    }

    // Drop
    if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
      socketManager.sendInput({
        type: 'drop',
        timestamp: Date.now(),
      });
    }
  }

  private handleTouchInput(time: number) {
    if (!this.touchControls) return;
    
    const input = this.touchControls.getInput();
    
    // Movement (with throttle)
    if (input.direction && time - this.lastInputTime >= this.inputThrottle) {
      socketManager.sendInput({
        type: 'move',
        direction: input.direction,
        timestamp: Date.now(),
      });
      this.lastInputTime = time;
    }
    
    // Interact (with debounce to prevent spam)
    if (input.interact && time - this.lastInteractTime > 300) {
      socketManager.sendInput({
        type: 'interact',
        timestamp: Date.now(),
      });
      this.lastInteractTime = time;
    }
    
    // Drop (with debounce)
    if (input.drop && time - this.lastDropTime > 300) {
      socketManager.sendInput({
        type: 'drop',
        timestamp: Date.now(),
      });
      this.lastDropTime = time;
    }
  }

  private updateGameDisplay(state: GameStateDTO) {
    // Update score
    this.scoreText.setText(`Score: ${state.score}`);

    // Update timer
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = Math.floor(state.timeRemaining % 60);
    this.timerText.setText(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`);

    // Update timer color when low
    if (state.timeRemaining < 30) {
      this.timerText.setColor('#e74c3c');
    }

    // Update players
    for (const [playerId, player] of Object.entries(state.players)) {
      const existingSprite = this.playerSprites.get(playerId);
      if (existingSprite) {
        existingSprite.destroy();
      }
      const newSprite = this.createPlayerSprite(player);
      this.playerSprites.set(playerId, newSprite);
    }

    // Update station items
    for (const station of state.stations) {
      const stationSprite = this.stationSprites.get(station.id);
      if (stationSprite && station.item) {
        // Remove existing item sprite if any
        const existingItem = this.itemSprites.get(station.id);
        if (existingItem) {
          existingItem.destroy();
        }

        // Add item on station
        const itemEmoji = this.getItemEmoji(station.item.type, station.item.state);
        const x = stationSprite.x;
        const y = stationSprite.y - 10;
        const item = this.add.text(x, y, itemEmoji, { fontSize: '20px' }).setOrigin(0.5);
        item.setDepth(5);
        
        // Show cooking progress
        if (station.type === 'stove' && station.item.cookProgress > 0 && station.item.state !== 'cooked') {
          const progress = this.add.rectangle(x, y + 25, 40 * (station.item.cookProgress / 100), 6, 
            station.item.state === 'burned' ? 0xff0000 : 0x00ff00);
          progress.setDepth(5);
        }
      }
    }

    // Update orders
    this.updateOrders(state.orders);
  }

  private updateOrders(orders: Order[]) {
    // Clear existing order displays
    this.ordersContainer.removeAll(true);

    orders.forEach((order, index) => {
      const y = index * 60;

      // Order background
      const bg = this.add.rectangle(0, y, 180, 55, 0xffffff);
      bg.setStrokeStyle(2, 0xddd);
      this.ordersContainer.add(bg);

      // Recipe name
      const name = this.add.text(-80, y - 15, order.recipe.name, {
        fontSize: '12px',
        fontFamily: 'Fredoka',
        color: '#5a4a3a',
      });
      this.ordersContainer.add(name);

      // Ingredients icons
      const ingredients = order.recipe.ingredients.map(i => 
        this.getItemEmoji(i.type, i.state)
      ).join(' ');
      const ingredientsText = this.add.text(-80, y + 5, ingredients, { fontSize: '16px' });
      this.ordersContainer.add(ingredientsText);

      // Timer
      const timerColor = order.timeRemaining < 10 ? '#e74c3c' : '#5a4a3a';
      const timer = this.add.text(70, y, `${Math.ceil(order.timeRemaining)}s`, {
        fontSize: '14px',
        fontFamily: 'Fredoka',
        color: timerColor,
      });
      this.ordersContainer.add(timer);
    });
  }
}
