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
  private stationHighlights: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private itemSprites: Map<string, Phaser.GameObjects.Container> = new Map();

  // UI Elements
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private ordersContainer!: Phaser.GameObjects.Container;
  private holdingIndicator!: Phaser.GameObjects.Container;
  private comboText!: Phaser.GameObjects.Text;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;
  private lastInputTime: number = 0;
  private inputThrottle: number = 80;
  
  // Touch controls
  private touchControls: TouchControls | null = null;
  private isTouchDevice: boolean = false;
  private lastInteractTime: number = 0;
  private lastDropTime: number = 0;

  // Kitchen dimensions
  private tileSize: number = 64;
  private offsetX: number = 100;
  private offsetY: number = 120;

  // Animation & Effects
  private lastScore: number = 0;
  private comboCount: number = 0;
  private lastOrderTime: number = 0;

  // Color palette
  private colors = {
    primary: 0xFFB347,
    secondary: 0xFF6B6B,
    success: 0x4ECDC4,
    warning: 0xFFE66D,
    danger: 0xE74C3C,
    background: 0xFFF5E6,
    wood: 0xDEB887,
    woodDark: 0x8B7355,
    floor1: 0xFFE4C4,
    floor2: 0xFFDAB9,
  };

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
  }

  create() {
    try {
      console.log('🎮 GameScene create() called!', this.gameState);

      this.isTouchDevice = TouchControls.isTouchDevice();
      console.log('📱 Touch device:', this.isTouchDevice);

      this.cameras.main.setBackgroundColor(this.colors.background);

      this.drawKitchen();
      this.createUI();
      this.setupInput();
      
      if (this.isTouchDevice) {
        this.touchControls = new TouchControls(this);
      }

      this.setupSocketCallbacks();

      if (this.gameState) {
        this.updateGameDisplay(this.gameState);
      }

      this.createFocusHint();
      
      console.log('🎮 GameScene create() completed successfully!');
    } catch (error) {
      console.error('🚨 GameScene create() error:', error);
    }
  }

  private drawKitchen() {
    const kitchenWidth = DEFAULT_KITCHEN.width * this.tileSize + 20;
    const kitchenHeight = DEFAULT_KITCHEN.height * this.tileSize + 20;
    
    // Shadow
    this.add.rectangle(
      this.offsetX + kitchenWidth/2 - 5, 
      this.offsetY + kitchenHeight/2 + 5, 
      kitchenWidth, kitchenHeight, 0x000000, 0.1
    ).setDepth(0);
    
    // Kitchen background
    this.add.rectangle(
      this.offsetX + kitchenWidth/2 - 10, 
      this.offsetY + kitchenHeight/2 - 10, 
      kitchenWidth, kitchenHeight, this.colors.wood
    ).setStrokeStyle(4, this.colors.woodDark).setDepth(0);

    // Floor tiles
    for (let x = 0; x < DEFAULT_KITCHEN.width; x++) {
      for (let y = 0; y < DEFAULT_KITCHEN.height; y++) {
        const tileX = this.offsetX + x * this.tileSize;
        const tileY = this.offsetY + y * this.tileSize;

        const color = (x + y) % 2 === 0 ? this.colors.floor1 : this.colors.floor2;
        const tile = this.add.rectangle(
          tileX + this.tileSize / 2, 
          tileY + this.tileSize / 2, 
          this.tileSize - 2, 
          this.tileSize - 2, 
          color
        );
        tile.setStrokeStyle(1, 0xE0D0C0);
        tile.setDepth(1);
      }
    }

    // Draw stations
    DEFAULT_KITCHEN.stations.forEach((stationConfig, index) => {
      const container = this.createStationSprite(
        stationConfig.type, 
        stationConfig.position.x, 
        stationConfig.position.y,
        stationConfig.ingredientType
      );
      this.stationSprites.set(`station_${index}`, container);
    });
  }

  private createStationSprite(
    type: string, 
    gridX: number, 
    gridY: number,
    ingredientType?: string
  ): Phaser.GameObjects.Container {
    const x = this.offsetX + gridX * this.tileSize + this.tileSize / 2;
    const y = this.offsetY + gridY * this.tileSize + this.tileSize / 2;

    const container = this.add.container(x, y);
    container.setDepth(2);

    let bgColor = this.colors.wood;
    let emoji = '📦';
    let label = '';
    let glowColor = 0x000000;

    switch (type) {
      case 'ingredient_box':
        bgColor = 0x90EE90;
        glowColor = 0x32CD32;
        emoji = this.getIngredientEmoji(ingredientType || 'fish');
        label = ingredientType?.toUpperCase() || '';
        break;
      case 'cutting_board':
        bgColor = 0xF5DEB3;
        glowColor = 0xDEB887;
        emoji = '🔪';
        label = 'CHOP';
        break;
      case 'stove':
        bgColor = 0xFF6B6B;
        glowColor = 0xFF4500;
        emoji = '🔥';
        label = 'COOK';
        break;
      case 'counter':
        bgColor = 0xD2B48C;
        glowColor = 0x8B7355;
        emoji = '📦';
        break;
      case 'plate_station':
        bgColor = 0xFFFFFF;
        glowColor = 0xC0C0C0;
        emoji = '🍽️';
        label = 'PLATE';
        break;
      case 'delivery':
        bgColor = 0x98FB98;
        glowColor = 0x00FF7F;
        emoji = '✅';
        label = 'SERVE';
        break;
      case 'trash':
        bgColor = 0x808080;
        glowColor = 0x404040;
        emoji = '🗑️';
        label = 'TRASH';
        break;
    }

    // Shadow
    const shadow = this.add.rectangle(3, 3, this.tileSize - 6, this.tileSize - 6, 0x000000, 0.2);
    container.add(shadow);

    // Background
    const bg = this.add.rectangle(0, 0, this.tileSize - 6, this.tileSize - 6, bgColor);
    bg.setStrokeStyle(3, glowColor);
    container.add(bg);

    // Icon
    const icon = this.add.text(0, label ? -5 : 0, emoji, { fontSize: '32px' }).setOrigin(0.5);
    container.add(icon);

    // Label
    if (label) {
      const labelText = this.add.text(0, 20, label, {
        fontSize: '8px',
        fontFamily: 'Arial Black',
        color: '#5a4a3a',
      }).setOrigin(0.5);
      container.add(labelText);
    }

    // Highlight for interaction
    const highlight = this.add.rectangle(x, y, this.tileSize + 4, this.tileSize + 4);
    highlight.setStrokeStyle(4, 0xFFD700);
    highlight.setFillStyle(0xFFD700, 0.1);
    highlight.setVisible(false);
    highlight.setDepth(1);
    this.stationHighlights.set(`station_${DEFAULT_KITCHEN.stations.findIndex(
      s => s.position.x === gridX && s.position.y === gridY
    )}`, highlight);

    return container;
  }

  private getIngredientEmoji(type: string): string {
    const emojis: Record<string, string> = {
      fish: '🐟',
      rice: '🍚',
      seaweed: '🥬',
      shrimp: '🦐',
      salmon: '🐠',
      cucumber: '🥒',
    };
    return emojis[type] || '📦';
  }

  private createPlayerSprite(player: Player): Phaser.GameObjects.Container {
    const x = this.offsetX + player.position.x * this.tileSize + this.tileSize / 2;
    const y = this.offsetY + player.position.y * this.tileSize + this.tileSize / 2;

    const container = this.add.container(x, y);
    const isMe = player.id === this.playerId;

    // Shadow
    const shadow = this.add.ellipse(0, 20, 40, 15, 0x000000, 0.3);
    container.add(shadow);

    // Ring indicator
    const ring = this.add.circle(0, 0, 28, isMe ? 0xFF6B6B : 0x4ECDC4, 0.3);
    ring.setStrokeStyle(3, isMe ? 0xFF6B6B : 0x4ECDC4);
    container.add(ring);

    // Cat emoji
    const catEmojis: Record<string, string> = {
      up: '😺',
      down: '😸',
      left: '😼',
      right: '😺',
    };
    const catEmoji = catEmojis[player.direction] || '😺';
    
    const cat = this.add.text(0, 0, catEmoji, { fontSize: '38px' }).setOrigin(0.5);
    if (player.direction === 'left') {
      cat.setScale(-1, 1);
    }
    container.add(cat);

    // Name badge
    const nameBg = this.add.rectangle(0, -42, player.name.length * 8 + 16, 20, 
      isMe ? 0xFF6B6B : 0x4ECDC4, 0.9);
    nameBg.setStrokeStyle(2, isMe ? 0xE74C3C : 0x3498DB);
    container.add(nameBg);
    
    const name = this.add.text(0, -42, isMe ? '⭐ ' + player.name : player.name, {
      fontSize: '11px',
      fontFamily: 'Arial Black',
      color: '#FFFFFF',
    }).setOrigin(0.5);
    container.add(name);

    // Holding item
    if (player.holdingItem) {
      const itemEmoji = this.getItemEmoji(player.holdingItem.type, player.holdingItem.state);
      
      const itemBg = this.add.circle(22, -18, 18, 0xFFFFFF, 0.95);
      itemBg.setStrokeStyle(2, 0xFFD700);
      container.add(itemBg);
      
      const item = this.add.text(22, -18, itemEmoji, { fontSize: '22px' }).setOrigin(0.5);
      container.add(item);

      // Bounce animation
      this.tweens.add({
        targets: [itemBg, item],
        y: '-=3',
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    container.setDepth(10);
    
    // Entry animation
    container.setScale(0);
    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

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
    const { width, height } = this.cameras.main;

    // Top bar
    const topBar = this.add.rectangle(width/2, 45, width, 90, 0xFFFFFF, 0.95);
    topBar.setStrokeStyle(2, this.colors.primary);
    topBar.setDepth(50);

    // Score
    const scoreContainer = this.add.container(30, 35);
    const scoreBg = this.add.rectangle(60, 0, 140, 50, this.colors.success, 0.2);
    scoreBg.setStrokeStyle(2, this.colors.success);
    scoreContainer.add(scoreBg);
    
    const scoreIcon = this.add.text(10, 0, '⭐', { fontSize: '28px' }).setOrigin(0.5);
    scoreContainer.add(scoreIcon);
    
    this.scoreText = this.add.text(70, 0, '0', {
      fontSize: '32px',
      fontFamily: 'Arial Black',
      color: '#2C3E50',
    }).setOrigin(0.5);
    scoreContainer.add(this.scoreText);
    scoreContainer.setDepth(51);

    // Timer
    const timerContainer = this.add.container(width - 30, 35);
    const timerBg = this.add.rectangle(-60, 0, 140, 50, this.colors.warning, 0.2);
    timerBg.setStrokeStyle(2, this.colors.warning);
    timerContainer.add(timerBg);
    
    const timerIcon = this.add.text(-110, 0, '⏱️', { fontSize: '28px' }).setOrigin(0.5);
    timerContainer.add(timerIcon);
    
    this.timerText = this.add.text(-50, 0, '3:00', {
      fontSize: '32px',
      fontFamily: 'Arial Black',
      color: '#2C3E50',
    }).setOrigin(0.5);
    timerContainer.add(this.timerText);
    timerContainer.setDepth(51);

    // Room code
    const roomBadge = this.add.container(width/2, 35);
    const roomBg = this.add.rectangle(0, 0, 160, 40, this.colors.primary, 0.2);
    roomBg.setStrokeStyle(2, this.colors.primary);
    roomBadge.add(roomBg);
    
    const roomIcon = this.add.text(-60, 0, '🏠', { fontSize: '20px' }).setOrigin(0.5);
    roomBadge.add(roomIcon);
    
    const roomText = this.add.text(10, 0, this.roomCode, {
      fontSize: '20px',
      fontFamily: 'Arial Black',
      color: '#E67E22',
    }).setOrigin(0.5);
    roomBadge.add(roomText);
    roomBadge.setDepth(51);

    // Orders panel
    const ordersX = width - 120;
    const ordersBg = this.add.rectangle(ordersX, height/2 + 20, 220, height - 120, 0xFFFFFF, 0.95);
    ordersBg.setStrokeStyle(3, this.colors.secondary);
    ordersBg.setDepth(49);

    const ordersTitle = this.add.text(ordersX, 100, '📋 ORDERS', {
      fontSize: '18px',
      fontFamily: 'Arial Black',
      color: '#E74C3C',
    }).setOrigin(0.5);
    ordersTitle.setDepth(50);

    this.ordersContainer = this.add.container(ordersX - 90, 130);
    this.ordersContainer.setDepth(50);

    // Combo text
    this.comboText = this.add.text(width/2, height/2, '', {
      fontSize: '48px',
      fontFamily: 'Arial Black',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.comboText.setDepth(100);
    this.comboText.setVisible(false);

    // Holding indicator
    this.holdingIndicator = this.add.container(30, height - 80);
    const holdingBg = this.add.rectangle(60, 0, 140, 60, 0xFFFFFF, 0.9);
    holdingBg.setStrokeStyle(2, this.colors.primary);
    this.holdingIndicator.add(holdingBg);
    
    const holdingLabel = this.add.text(10, -15, 'Holding:', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#8B7355',
    });
    this.holdingIndicator.add(holdingLabel);
    
    const holdingItem = this.add.text(70, 8, '(nothing)', { fontSize: '24px' }).setOrigin(0.5);
    holdingItem.setName('holdingItem');
    this.holdingIndicator.add(holdingItem);
    this.holdingIndicator.setDepth(51);
  }

  private createFocusHint() {
    const { width, height } = this.cameras.main;
    
    const controlsY = height - 25;
    const controlsBg = this.add.rectangle(width/2, controlsY, width, 40, 0x2C3E50, 0.9);
    controlsBg.setDepth(50);
    
    const controlsText = this.isTouchDevice 
      ? '👆 Use joystick to move | 🐾 Interact | 📦 Drop'
      : '⌨️ WASD: Move | SPACE: Interact | E: Drop | 🖱️ Click to focus';
    
    this.add.text(width/2, controlsY, controlsText, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(51);

    this.input.on('pointerdown', () => {
      this.game.canvas.focus();
    });
    
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
      const { width, height } = this.cameras.main;
      
      const overlay = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.7);
      overlay.setDepth(200);
      
      const message = this.add.text(width/2, height/2, '😿 Partner left!\nReturning to menu...', {
        fontSize: '32px',
        fontFamily: 'Arial Black',
        color: '#FFFFFF',
        align: 'center',
      }).setOrigin(0.5);
      message.setDepth(201);

      this.time.delayedCall(2000, () => {
        this.scene.start('MenuScene');
      });
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

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    for (const dir of directions) {
      const checkX = player.position.x + dir.dx;
      const checkY = player.position.y + dir.dy;
      
      const stationIndex = DEFAULT_KITCHEN.stations.findIndex(
        s => s.position.x === checkX && s.position.y === checkY
      );
      
      if (stationIndex !== -1) {
        const highlight = this.stationHighlights.get(`station_${stationIndex}`);
        if (highlight) {
          highlight.setVisible(true);
        }
      }
    }
  }

  private handleKeyboardInput(time: number) {
    if (time - this.lastInputTime < this.inputThrottle) return;
    if (!this.cursors || !this.wasd || !this.spaceKey || !this.eKey) return;

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

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      socketManager.sendInput({
        type: 'interact',
        timestamp: Date.now(),
      });
      this.showInteractFeedback();
    }

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
    
    if (input.direction && time - this.lastInputTime >= this.inputThrottle) {
      socketManager.sendInput({
        type: 'move',
        direction: input.direction,
        timestamp: Date.now(),
      });
      this.lastInputTime = time;
    }
    
    if (input.interact && time - this.lastInteractTime > 300) {
      socketManager.sendInput({
        type: 'interact',
        timestamp: Date.now(),
      });
      this.lastInteractTime = time;
      this.showInteractFeedback();
    }
    
    if (input.drop && time - this.lastDropTime > 300) {
      socketManager.sendInput({
        type: 'drop',
        timestamp: Date.now(),
      });
      this.lastDropTime = time;
    }
  }

  private showInteractFeedback() {
    const player = this.gameState?.players[this.playerId];
    if (!player) return;

    const x = this.offsetX + player.position.x * this.tileSize + this.tileSize/2;
    const y = this.offsetY + player.position.y * this.tileSize;

    const feedback = this.add.text(x, y - 40, '✨', { fontSize: '24px' }).setOrigin(0.5);
    feedback.setDepth(100);
    
    this.tweens.add({
      targets: feedback,
      y: y - 60,
      alpha: 0,
      duration: 400,
      onComplete: () => feedback.destroy(),
    });
  }

  private updateGameDisplay(state: GameStateDTO) {
    // Score animation
    const newScore = state.score;
    if (newScore > this.lastScore) {
      this.showScorePopup(newScore - this.lastScore);
      this.checkCombo();
    }
    this.lastScore = newScore;
    this.scoreText.setText(newScore.toString());

    // Timer
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = Math.floor(state.timeRemaining % 60);
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

    if (state.timeRemaining < 30) {
      this.timerText.setColor('#E74C3C');
      if (!this.timerText.getData('pulsing')) {
        this.timerText.setData('pulsing', true);
        this.tweens.add({
          targets: this.timerText,
          scale: 1.1,
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      this.timerText.setColor('#2C3E50');
    }

    // Update players
    for (const [playerId, player] of Object.entries(state.players)) {
      const existingSprite = this.playerSprites.get(playerId);
      if (existingSprite) {
        existingSprite.destroy();
      }
      const newSprite = this.createPlayerSprite(player);
      this.playerSprites.set(playerId, newSprite);

      // Update holding indicator
      if (playerId === this.playerId) {
        const holdingItem = this.holdingIndicator.getByName('holdingItem') as Phaser.GameObjects.Text;
        if (holdingItem) {
          if (player.holdingItem) {
            const emoji = this.getItemEmoji(player.holdingItem.type, player.holdingItem.state);
            holdingItem.setText(emoji);
          } else {
            holdingItem.setText('(empty)');
          }
        }
      }
    }

    // Update station items
    this.updateStationItems(state);

    // Update orders
    this.updateOrders(state.orders);
  }

  private updateStationItems(state: GameStateDTO) {
    this.itemSprites.forEach(sprite => sprite.destroy());
    this.itemSprites.clear();

    for (const station of state.stations) {
      if (station.item) {
        const x = this.offsetX + station.position.x * this.tileSize + this.tileSize/2;
        const y = this.offsetY + station.position.y * this.tileSize + this.tileSize/2;

        const itemContainer = this.add.container(x, y - 5);
        itemContainer.setDepth(8);

        const itemEmoji = this.getItemEmoji(station.item.type, station.item.state);
        const item = this.add.text(0, 0, itemEmoji, { fontSize: '24px' }).setOrigin(0.5);
        itemContainer.add(item);

        // Cooking progress bar
        if (station.type === 'stove' && station.item.cookProgress > 0) {
          const barWidth = 50;
          const barHeight = 8;
          const progress = station.item.cookProgress / 100;
          
          const barBg = this.add.rectangle(0, 25, barWidth, barHeight, 0x333333);
          itemContainer.add(barBg);
          
          const barColor = station.item.state === 'burned' ? 0xFF0000 : 
                          progress > 0.8 ? 0xFFAA00 : 0x00FF00;
          const bar = this.add.rectangle(
            -barWidth/2 + (barWidth * progress)/2, 
            25, 
            barWidth * progress, 
            barHeight - 2, 
            barColor
          );
          itemContainer.add(bar);

          // Warning animation
          if (progress > 0.7 && station.item.state !== 'cooked' && station.item.state !== 'burned') {
            this.tweens.add({
              targets: item,
              scale: 1.2,
              duration: 200,
              yoyo: true,
              repeat: 2,
            });
          }
        }

        // Chopping indicator
        if (station.type === 'cutting_board' && station.item.state === 'raw') {
          const chopIcon = this.add.text(15, -10, '🔪', { fontSize: '16px' }).setOrigin(0.5);
          itemContainer.add(chopIcon);
        }

        this.itemSprites.set(station.id, itemContainer);
      }
    }
  }

  private showScorePopup(points: number) {
    const { width } = this.cameras.main;
    const popup = this.add.text(width/2, 100, `+${points}! 🎉`, {
      fontSize: '36px',
      fontFamily: 'Arial Black',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    popup.setDepth(100);

    this.tweens.add({
      targets: popup,
      y: 60,
      alpha: 0,
      scale: 1.5,
      duration: 800,
      ease: 'Power2',
      onComplete: () => popup.destroy(),
    });
  }

  private checkCombo() {
    const now = Date.now();
    if (now - this.lastOrderTime < 5000) {
      this.comboCount++;
      if (this.comboCount >= 2) {
        this.showCombo();
      }
    } else {
      this.comboCount = 1;
    }
    this.lastOrderTime = now;
  }

  private showCombo() {
    const combos = ['NICE! 🔥', 'GREAT! ⚡', 'AMAZING! 🌟', 'PURRFECT! 😻'];
    const comboIndex = Math.min(this.comboCount - 2, combos.length - 1);
    
    this.comboText.setText(combos[comboIndex]);
    this.comboText.setVisible(true);
    this.comboText.setScale(0);
    
    this.tweens.add({
      targets: this.comboText,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(800, () => {
          this.tweens.add({
            targets: this.comboText,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              this.comboText.setVisible(false);
              this.comboText.setAlpha(1);
            },
          });
        });
      },
    });
  }

  private updateOrders(orders: Order[]) {
    this.ordersContainer.removeAll(true);

    orders.forEach((order, index) => {
      const y = index * 85;
      const orderContainer = this.add.container(0, y);

      // Order card
      const urgency = order.timeRemaining < 15 ? 0xFFCCCC : 
                     order.timeRemaining < 30 ? 0xFFF3CD : 0xFFFFFF;
      const bg = this.add.rectangle(90, 30, 180, 75, urgency);
      bg.setStrokeStyle(2, order.timeRemaining < 15 ? 0xE74C3C : 0xDDD);
      orderContainer.add(bg);

      // Recipe name
      const name = this.add.text(10, 10, order.recipe.name, {
        fontSize: '13px',
        fontFamily: 'Arial Black',
        color: '#2C3E50',
      });
      orderContainer.add(name);

      // Ingredients
      const ingredients = order.recipe.ingredients.map(i => 
        this.getItemEmoji(i.type, i.state)
      ).join(' ');
      const ingredientsText = this.add.text(10, 32, ingredients, { fontSize: '20px' });
      orderContainer.add(ingredientsText);

      // Timer
      const timerColor = order.timeRemaining < 15 ? '#E74C3C' : 
                        order.timeRemaining < 30 ? '#F39C12' : '#27AE60';
      const timer = this.add.text(160, 32, `${Math.ceil(order.timeRemaining)}s`, {
        fontSize: '16px',
        fontFamily: 'Arial Black',
        color: timerColor,
      });
      orderContainer.add(timer);

      // Urgency animation
      if (order.timeRemaining < 15) {
        this.tweens.add({
          targets: orderContainer,
          x: '+=3',
          duration: 100,
          yoyo: true,
          repeat: 2,
        });
      }

      this.ordersContainer.add(orderContainer);
    });
  }
}
