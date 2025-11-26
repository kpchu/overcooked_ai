import Phaser from 'phaser';
import { socketManager } from '../network/SocketManager';
import { TouchControls } from '../ui/TouchControls';
import {
  GameStateDTO,
  Player,
  Order,
  DEFAULT_KITCHEN,
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

  // Graphics - use position tracking to avoid recreation
  private playerSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private playerPositions: Map<string, { x: number; y: number; direction: string; holdingItem: string | null }> = new Map();
  private stationSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private stationHighlights: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private itemSprites: Map<string, Phaser.GameObjects.Container> = new Map();

  // UI Elements
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private ordersContainer!: Phaser.GameObjects.Container;
  private holdingText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;
  private lastInputTime: number = 0;
  private inputThrottle: number = 100;
  
  // Touch controls
  private touchControls: TouchControls | null = null;
  private isTouchDevice: boolean = false;
  private lastInteractTime: number = 0;
  private lastDropTime: number = 0;

  // Kitchen dimensions - responsive
  private tileSize: number = 64;
  private offsetX: number = 100;
  private offsetY: number = 100;

  // Animation & Effects
  private lastScore: number = 0;
  private comboCount: number = 0;
  private lastOrderTime: number = 0;
  private timerPulsing: boolean = false;

  // Sounds
  private sounds: {
    pickup?: Phaser.Sound.BaseSound;
    drop?: Phaser.Sound.BaseSound;
    chop?: Phaser.Sound.BaseSound;
    cook?: Phaser.Sound.BaseSound;
    serve?: Phaser.Sound.BaseSound;
    orderComplete?: Phaser.Sound.BaseSound;
    orderFail?: Phaser.Sound.BaseSound;
    tick?: Phaser.Sound.BaseSound;
  } = {};

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneData) {
    this.playerId = data.playerId;
    this.playerName = data.playerName;
    this.roomCode = data.roomCode;
    this.gameState = data.initialState;
    this.lastScore = 0;
    this.comboCount = 0;
    this.playerPositions.clear();
    this.timerPulsing = false;
    
    console.log('🎮 GameScene init - playerId:', this.playerId, 'playerName:', this.playerName);
  }

  create() {
    try {
      this.isTouchDevice = TouchControls.isTouchDevice();
      
      // Calculate responsive dimensions
      this.calculateDimensions();

      this.cameras.main.setBackgroundColor(0xFFF5E6);

      this.drawKitchen();
      this.createUI();
      this.setupInput();
      this.createSounds();
      
      if (this.isTouchDevice) {
        this.touchControls = new TouchControls(this);
      }

      this.setupSocketCallbacks();

      if (this.gameState) {
        this.updateGameDisplay(this.gameState);
      }

      // Focus hint
      this.input.on('pointerdown', () => {
        this.game.canvas.focus();
      });
      this.game.canvas.setAttribute('tabindex', '1');
      this.game.canvas.focus();

      // Handle resize
      this.scale.on('resize', this.handleResize, this);
      
    } catch (error) {
      console.error('GameScene create error:', error);
    }
  }

  private calculateDimensions() {
    const { width, height } = this.cameras.main;
    
    // Calculate tile size to fit the kitchen on screen
    const kitchenWidth = DEFAULT_KITCHEN.width;
    const kitchenHeight = DEFAULT_KITCHEN.height;
    
    // Leave space for UI (top bar: 80px, orders panel: 200px on right, bottom bar: 50px)
    const availableWidth = width - (this.isTouchDevice ? 50 : 220);
    const availableHeight = height - 150;
    
    // Calculate tile size to fit
    const maxTileByWidth = Math.floor(availableWidth / kitchenWidth);
    const maxTileByHeight = Math.floor(availableHeight / kitchenHeight);
    
    this.tileSize = Math.min(maxTileByWidth, maxTileByHeight, 64);
    this.tileSize = Math.max(this.tileSize, 40); // Minimum tile size
    
    // Center the kitchen
    const totalKitchenWidth = kitchenWidth * this.tileSize;
    this.offsetX = Math.max(20, (availableWidth - totalKitchenWidth) / 2 + 10);
    this.offsetY = 90;
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    // Recalculate and redraw on resize
    this.calculateDimensions();
  }

  private createSounds() {
    // Create simple synth sounds using Web Audio API
    // These will be triggered manually
  }

  private playSound(type: 'pickup' | 'drop' | 'chop' | 'cook' | 'serve' | 'complete' | 'fail') {
    // Use Web Audio for simple beeps
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      const now = audioContext.currentTime;
      
      switch (type) {
        case 'pickup':
          oscillator.frequency.setValueAtTime(523, now); // C5
          oscillator.frequency.setValueAtTime(659, now + 0.05); // E5
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.setValueAtTime(0.01, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
          break;
        case 'drop':
          oscillator.frequency.setValueAtTime(330, now);
          gainNode.gain.setValueAtTime(0.1, now);
          oscillator.start(now);
          oscillator.stop(now + 0.08);
          break;
        case 'chop':
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(200, now);
          oscillator.frequency.setValueAtTime(150, now + 0.02);
          gainNode.gain.setValueAtTime(0.08, now);
          oscillator.start(now);
          oscillator.stop(now + 0.05);
          break;
        case 'complete':
          oscillator.frequency.setValueAtTime(523, now);
          oscillator.frequency.setValueAtTime(659, now + 0.1);
          oscillator.frequency.setValueAtTime(784, now + 0.2);
          gainNode.gain.setValueAtTime(0.15, now);
          oscillator.start(now);
          oscillator.stop(now + 0.35);
          break;
        case 'fail':
          oscillator.frequency.setValueAtTime(200, now);
          oscillator.frequency.setValueAtTime(150, now + 0.1);
          gainNode.gain.setValueAtTime(0.1, now);
          oscillator.start(now);
          oscillator.stop(now + 0.2);
          break;
      }
    } catch (e) {
      // Audio not available
    }
  }

  private drawKitchen() {
    const kitchenWidth = DEFAULT_KITCHEN.width * this.tileSize + 20;
    const kitchenHeight = DEFAULT_KITCHEN.height * this.tileSize + 20;
    
    // Kitchen background
    this.add.rectangle(
      this.offsetX + kitchenWidth/2 - 10, 
      this.offsetY + kitchenHeight/2 - 10, 
      kitchenWidth, kitchenHeight, 0xDEB887
    ).setStrokeStyle(4, 0x8B7355).setDepth(0);

    // Floor tiles
    for (let x = 0; x < DEFAULT_KITCHEN.width; x++) {
      for (let y = 0; y < DEFAULT_KITCHEN.height; y++) {
        const tileX = this.offsetX + x * this.tileSize;
        const tileY = this.offsetY + y * this.tileSize;
        const color = (x + y) % 2 === 0 ? 0xFFE4C4 : 0xFFDAB9;
        this.add.rectangle(
          tileX + this.tileSize / 2, 
          tileY + this.tileSize / 2, 
          this.tileSize - 2, 
          this.tileSize - 2, 
          color
        ).setDepth(1);
      }
    }

    // Draw stations
    DEFAULT_KITCHEN.stations.forEach((config, index) => {
      const container = this.createStationSprite(config.type, config.position.x, config.position.y, config.ingredientType);
      this.stationSprites.set(`station_${index}`, container);
    });
  }

  private createStationSprite(type: string, gridX: number, gridY: number, ingredientType?: string): Phaser.GameObjects.Container {
    const x = this.offsetX + gridX * this.tileSize + this.tileSize / 2;
    const y = this.offsetY + gridY * this.tileSize + this.tileSize / 2;

    const container = this.add.container(x, y);
    container.setDepth(2);

    let bgColor = 0xDEB887;
    let emoji = '📦';
    let label = '';

    switch (type) {
      case 'ingredient_box':
        bgColor = 0x90EE90;
        emoji = this.getIngredientEmoji(ingredientType || 'fish');
        label = (ingredientType || '').toUpperCase();
        break;
      case 'cutting_board':
        bgColor = 0xF5DEB3;
        emoji = '🔪';
        label = 'CHOP';
        break;
      case 'stove':
        bgColor = 0xFF6B6B;
        emoji = '🔥';
        label = 'COOK';
        break;
      case 'counter':
        bgColor = 0xD2B48C;
        emoji = '📦';
        break;
      case 'plate_station':
        bgColor = 0xFFFFFF;
        emoji = '🍽️';
        label = 'PLATE';
        break;
      case 'delivery':
        bgColor = 0x98FB98;
        emoji = '✅';
        label = 'SERVE';
        break;
      case 'trash':
        bgColor = 0x808080;
        emoji = '🗑️';
        break;
    }

    const size = this.tileSize - 6;
    const bg = this.add.rectangle(0, 0, size, size, bgColor);
    bg.setStrokeStyle(2, 0x5a4a3a);
    container.add(bg);

    const fontSize = Math.max(20, this.tileSize * 0.5);
    const icon = this.add.text(0, label ? -5 : 0, emoji, { fontSize: `${fontSize}px` }).setOrigin(0.5);
    container.add(icon);

    if (label) {
      const labelSize = Math.max(8, this.tileSize * 0.12);
      const labelText = this.add.text(0, size/2 - 8, label, {
        fontSize: `${labelSize}px`,
        fontFamily: 'Arial',
        color: '#5a4a3a',
      }).setOrigin(0.5);
      container.add(labelText);
    }

    // Highlight (invisible initially)
    const highlight = this.add.rectangle(x, y, this.tileSize + 2, this.tileSize + 2);
    highlight.setStrokeStyle(3, 0xFFD700);
    highlight.setFillStyle(0xFFD700, 0.15);
    highlight.setVisible(false);
    highlight.setDepth(1);
    const stationIndex = DEFAULT_KITCHEN.stations.findIndex(s => s.position.x === gridX && s.position.y === gridY);
    this.stationHighlights.set(`station_${stationIndex}`, highlight);

    return container;
  }

  private getIngredientEmoji(type: string): string {
    const emojis: Record<string, string> = { fish: '🐟', rice: '🍚', seaweed: '🥬', shrimp: '🦐', salmon: '🐠', cucumber: '🥒' };
    return emojis[type] || '📦';
  }

  private createOrUpdatePlayerSprite(player: Player): void {
    const x = this.offsetX + player.position.x * this.tileSize + this.tileSize / 2;
    const y = this.offsetY + player.position.y * this.tileSize + this.tileSize / 2;
    const isMe = player.id === this.playerId;
    const holdingKey = player.holdingItem ? `${player.holdingItem.type}_${player.holdingItem.state}` : null;

    // Check if we need to recreate sprite
    const prevPos = this.playerPositions.get(player.id);
    const existingSprite = this.playerSprites.get(player.id);

    if (existingSprite && prevPos) {
      // Only update position if changed, don't recreate
      if (prevPos.x === player.position.x && 
          prevPos.y === player.position.y && 
          prevPos.direction === player.direction &&
          prevPos.holdingItem === holdingKey) {
        return; // No change needed
      }
      // Destroy and recreate only if something changed
      existingSprite.destroy();
    }

    // Save new position state
    this.playerPositions.set(player.id, {
      x: player.position.x,
      y: player.position.y,
      direction: player.direction,
      holdingItem: holdingKey
    });

    const container = this.add.container(x, y);

    // Shadow
    const shadowSize = this.tileSize * 0.6;
    const shadow = this.add.ellipse(0, this.tileSize * 0.3, shadowSize, shadowSize * 0.4, 0x000000, 0.25);
    container.add(shadow);

    // Ring
    const ringSize = this.tileSize * 0.45;
    const ring = this.add.circle(0, 0, ringSize, isMe ? 0xFF6B6B : 0x4ECDC4, 0.25);
    ring.setStrokeStyle(2, isMe ? 0xFF6B6B : 0x4ECDC4);
    container.add(ring);

    // Cat emoji
    const catEmoji = isMe ? '😺' : '😸';
    const catSize = Math.max(28, this.tileSize * 0.6);
    const cat = this.add.text(0, 0, catEmoji, { fontSize: `${catSize}px` }).setOrigin(0.5);
    container.add(cat);

    // Name badge
    const nameSize = Math.max(9, this.tileSize * 0.15);
    const displayName = isMe ? `⭐${player.name}` : player.name;
    const nameBg = this.add.rectangle(0, -this.tileSize * 0.6, displayName.length * 5 + 10, 16, 
      isMe ? 0xFF6B6B : 0x4ECDC4, 0.9);
    container.add(nameBg);
    
    const name = this.add.text(0, -this.tileSize * 0.6, displayName, {
      fontSize: `${nameSize}px`,
      fontFamily: 'Arial',
      color: '#FFFFFF',
    }).setOrigin(0.5);
    container.add(name);

    // Holding item (no animation to prevent flashing)
    if (player.holdingItem) {
      const itemEmoji = this.getItemEmoji(player.holdingItem.type, player.holdingItem.state);
      const itemBgSize = this.tileSize * 0.3;
      const itemBg = this.add.circle(this.tileSize * 0.35, -this.tileSize * 0.3, itemBgSize, 0xFFFFFF, 0.95);
      itemBg.setStrokeStyle(2, 0xFFD700);
      container.add(itemBg);
      
      const itemSize = Math.max(16, this.tileSize * 0.35);
      const item = this.add.text(this.tileSize * 0.35, -this.tileSize * 0.3, itemEmoji, { fontSize: `${itemSize}px` }).setOrigin(0.5);
      container.add(item);
    }

    container.setDepth(10);
    this.playerSprites.set(player.id, container);
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
    const { width, height } = this.cameras.main;

    // Top bar
    this.add.rectangle(width/2, 40, width, 70, 0xFFFFFF, 0.95).setStrokeStyle(2, 0xFFB347).setDepth(50);

    // Score
    this.add.text(20, 40, '⭐', { fontSize: '24px' }).setOrigin(0, 0.5).setDepth(51);
    this.scoreText = this.add.text(50, 40, '0', {
      fontSize: '28px',
      fontFamily: 'Arial Black',
      color: '#2C3E50',
    }).setOrigin(0, 0.5).setDepth(51);

    // Timer
    this.add.text(width - 120, 40, '⏱️', { fontSize: '24px' }).setOrigin(0, 0.5).setDepth(51);
    this.timerText = this.add.text(width - 90, 40, '3:00', {
      fontSize: '28px',
      fontFamily: 'Arial Black',
      color: '#2C3E50',
    }).setOrigin(0, 0.5).setDepth(51);

    // Room code
    this.add.text(width/2, 40, `🏠 ${this.roomCode}`, {
      fontSize: '18px',
      fontFamily: 'Arial Black',
      color: '#E67E22',
    }).setOrigin(0.5).setDepth(51);

    // Orders panel (hide on very small screens)
    if (width > 500) {
      const ordersX = width - 110;
      this.add.rectangle(ordersX, height/2 + 30, 200, height - 100, 0xFFFFFF, 0.9)
        .setStrokeStyle(2, 0xFF6B6B).setDepth(49);
      this.add.text(ordersX, 85, '📋 ORDERS', {
        fontSize: '14px', fontFamily: 'Arial Black', color: '#E74C3C',
      }).setOrigin(0.5).setDepth(50);
      this.ordersContainer = this.add.container(ordersX - 85, 105).setDepth(50);
    } else {
      // Compact orders at top for mobile
      this.ordersContainer = this.add.container(width - 180, 60).setDepth(50);
    }

    // Combo text
    this.comboText = this.add.text(width/2, height/2, '', {
      fontSize: '36px', fontFamily: 'Arial Black', color: '#FFD700',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(100).setVisible(false);

    // Holding indicator
    const holdingY = height - (this.isTouchDevice ? 150 : 40);
    this.add.rectangle(80, holdingY, 140, 35, 0xFFFFFF, 0.9).setStrokeStyle(2, 0xFFB347).setDepth(51);
    this.add.text(20, holdingY, 'Holding:', { fontSize: '12px', color: '#8B7355' }).setOrigin(0, 0.5).setDepth(51);
    this.holdingText = this.add.text(90, holdingY, '(empty)', { fontSize: '20px' }).setOrigin(0, 0.5).setDepth(51);

    // Controls hint
    const controlsY = height - 15;
    this.add.rectangle(width/2, controlsY, width, 25, 0x2C3E50, 0.85).setDepth(50);
    const controlsText = this.isTouchDevice 
      ? '👆 Joystick: Move | 🐾 Interact | 📦 Drop'
      : '⌨️ WASD: Move | SPACE: Interact | E: Drop';
    this.add.text(width/2, controlsY, controlsText, {
      fontSize: '11px', fontFamily: 'Arial', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(51);
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
      this.gameState = state;
      this.updateGameDisplay(state);
    };

    socketManager.onGameOver = (data) => {
      this.scene.start('GameOverScene', { score: data.score, won: data.won, roomCode: this.roomCode });
    };

    socketManager.onPlayerLeft = () => {
      const { width, height } = this.cameras.main;
      this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.7).setDepth(200);
      this.add.text(width/2, height/2, '😿 Partner left!', {
        fontSize: '28px', fontFamily: 'Arial Black', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(201);
      this.time.delayedCall(2000, () => this.scene.start('MenuScene'));
    };
  }

  update(time: number) {
    if (this.cursors && this.wasd) {
      this.handleKeyboardInput(time);
    }
    if (this.touchControls) {
      this.handleTouchInput(time);
    }
    this.updateStationHighlights();
  }

  private updateStationHighlights() {
    if (!this.gameState) return;
    const player = this.gameState.players[this.playerId];
    if (!player) return;

    this.stationHighlights.forEach(h => h.setVisible(false));

    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    for (const dir of dirs) {
      const idx = DEFAULT_KITCHEN.stations.findIndex(
        s => s.position.x === player.position.x + dir.dx && s.position.y === player.position.y + dir.dy
      );
      if (idx !== -1) {
        this.stationHighlights.get(`station_${idx}`)?.setVisible(true);
      }
    }
  }

  private handleKeyboardInput(time: number) {
    if (time - this.lastInputTime < this.inputThrottle) return;
    if (!this.cursors || !this.wasd) return;

    let direction: 'up' | 'down' | 'left' | 'right' | null = null;
    if (this.cursors.up.isDown || this.wasd.W.isDown) direction = 'up';
    else if (this.cursors.down.isDown || this.wasd.S.isDown) direction = 'down';
    else if (this.cursors.left.isDown || this.wasd.A.isDown) direction = 'left';
    else if (this.cursors.right.isDown || this.wasd.D.isDown) direction = 'right';

    if (direction) {
      socketManager.sendInput({ type: 'move', direction, timestamp: Date.now() });
      this.lastInputTime = time;
    }

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      socketManager.sendInput({ type: 'interact', timestamp: Date.now() });
      this.playSound('pickup');
    }

    if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
      socketManager.sendInput({ type: 'drop', timestamp: Date.now() });
      this.playSound('drop');
    }
  }

  private handleTouchInput(time: number) {
    if (!this.touchControls) return;
    const input = this.touchControls.getInput();
    
    if (input.direction && time - this.lastInputTime >= this.inputThrottle) {
      socketManager.sendInput({ type: 'move', direction: input.direction, timestamp: Date.now() });
      this.lastInputTime = time;
    }
    
    if (input.interact && time - this.lastInteractTime > 300) {
      socketManager.sendInput({ type: 'interact', timestamp: Date.now() });
      this.lastInteractTime = time;
      this.playSound('pickup');
    }
    
    if (input.drop && time - this.lastDropTime > 300) {
      socketManager.sendInput({ type: 'drop', timestamp: Date.now() });
      this.lastDropTime = time;
      this.playSound('drop');
    }
  }

  private updateGameDisplay(state: GameStateDTO) {
    // Score
    if (state.score > this.lastScore) {
      this.showScorePopup(state.score - this.lastScore);
      this.checkCombo();
      this.playSound('complete');
    }
    this.lastScore = state.score;
    this.scoreText.setText(state.score.toString());

    // Timer
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = Math.floor(state.timeRemaining % 60);
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

    if (state.timeRemaining < 30 && !this.timerPulsing) {
      this.timerText.setColor('#E74C3C');
      this.timerPulsing = true;
    }

    // Players - update without recreation if possible
    for (const [playerId, player] of Object.entries(state.players)) {
      this.createOrUpdatePlayerSprite(player);

      if (playerId === this.playerId) {
        if (player.holdingItem) {
          this.holdingText.setText(this.getItemEmoji(player.holdingItem.type, player.holdingItem.state));
        } else {
          this.holdingText.setText('(empty)');
        }
      }
    }

    // Clean up disconnected players
    for (const playerId of this.playerSprites.keys()) {
      if (!state.players[playerId]) {
        this.playerSprites.get(playerId)?.destroy();
        this.playerSprites.delete(playerId);
        this.playerPositions.delete(playerId);
      }
    }

    this.updateStationItems(state);
    this.updateOrders(state.orders);
  }

  private updateStationItems(state: GameStateDTO) {
    this.itemSprites.forEach(s => s.destroy());
    this.itemSprites.clear();

    for (const station of state.stations) {
      if (station.item) {
        const x = this.offsetX + station.position.x * this.tileSize + this.tileSize/2;
        const y = this.offsetY + station.position.y * this.tileSize + this.tileSize/2;

        const container = this.add.container(x, y - 5).setDepth(8);
        const itemEmoji = this.getItemEmoji(station.item.type, station.item.state);
        const itemSize = Math.max(18, this.tileSize * 0.4);
        container.add(this.add.text(0, 0, itemEmoji, { fontSize: `${itemSize}px` }).setOrigin(0.5));

        // Cooking progress
        if (station.type === 'stove' && station.item.cookProgress > 0) {
          const progress = station.item.cookProgress / 100;
          const barW = this.tileSize * 0.8;
          container.add(this.add.rectangle(0, 20, barW, 6, 0x333333));
          const barColor = station.item.state === 'burned' ? 0xFF0000 : progress > 0.8 ? 0xFFAA00 : 0x00FF00;
          container.add(this.add.rectangle(-barW/2 + (barW * progress)/2, 20, barW * progress, 4, barColor));
        }

        this.itemSprites.set(station.id, container);
      }
    }
  }

  private showScorePopup(points: number) {
    const { width } = this.cameras.main;
    const popup = this.add.text(width/2, 90, `+${points}! 🎉`, {
      fontSize: '32px', fontFamily: 'Arial Black', color: '#FFD700', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: popup, y: 60, alpha: 0, scale: 1.3, duration: 700, ease: 'Power2',
      onComplete: () => popup.destroy(),
    });
  }

  private checkCombo() {
    const now = Date.now();
    if (now - this.lastOrderTime < 5000) {
      this.comboCount++;
      if (this.comboCount >= 2) this.showCombo();
    } else {
      this.comboCount = 1;
    }
    this.lastOrderTime = now;
  }

  private showCombo() {
    const combos = ['NICE! 🔥', 'GREAT! ⚡', 'AMAZING! 🌟', 'PURRFECT! 😻'];
    this.comboText.setText(combos[Math.min(this.comboCount - 2, combos.length - 1)]);
    this.comboText.setVisible(true).setScale(0).setAlpha(1);
    
    this.tweens.add({
      targets: this.comboText, scale: 1, duration: 250, ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(600, () => {
          this.tweens.add({
            targets: this.comboText, alpha: 0, duration: 250,
            onComplete: () => this.comboText.setVisible(false),
          });
        });
      },
    });
  }

  private updateOrders(orders: Order[]) {
    this.ordersContainer.removeAll(true);
    const compact = this.cameras.main.width < 500;

    orders.forEach((order, index) => {
      const y = compact ? 0 : index * 70;
      const x = compact ? index * 150 : 0;
      
      const c = this.add.container(x, y);
      const urgency = order.timeRemaining < 15 ? 0xFFCCCC : order.timeRemaining < 30 ? 0xFFF3CD : 0xFFFFFF;
      c.add(this.add.rectangle(compact ? 65 : 85, 25, compact ? 140 : 170, compact ? 50 : 60, urgency)
        .setStrokeStyle(1, order.timeRemaining < 15 ? 0xE74C3C : 0xDDD));

      c.add(this.add.text(5, 8, order.recipe.name, { fontSize: '11px', fontFamily: 'Arial', color: '#2C3E50' }));
      
      const ingredients = order.recipe.ingredients.map(i => this.getItemEmoji(i.type, i.state)).join('');
      c.add(this.add.text(5, 26, ingredients, { fontSize: '16px' }));

      const timerColor = order.timeRemaining < 15 ? '#E74C3C' : order.timeRemaining < 30 ? '#F39C12' : '#27AE60';
      c.add(this.add.text(compact ? 120 : 150, 26, `${Math.ceil(order.timeRemaining)}s`, {
        fontSize: '14px', fontFamily: 'Arial Black', color: timerColor,
      }));

      this.ordersContainer.add(c);
    });
  }
}
