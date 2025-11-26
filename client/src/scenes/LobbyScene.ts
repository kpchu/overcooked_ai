import Phaser from 'phaser';
import { socketManager } from '../network/SocketManager';
import { RoomInfo } from '../shared/types';

interface LobbyData {
  roomCode: string;
  playerId: string;
  playerName: string;
  isHost: boolean;
  room?: RoomInfo;
}

export class LobbyScene extends Phaser.Scene {
  private roomCode: string = '';
  private playerId: string = '';
  private playerName: string = '';
  private isHost: boolean = false;
  private room: RoomInfo | null = null;
  private playerTexts: Phaser.GameObjects.Text[] = [];
  private readyButton!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Text;
  private isReady: boolean = false;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  init(data: LobbyData) {
    this.roomCode = data.roomCode;
    this.playerId = data.playerId;
    this.playerName = data.playerName;
    this.isHost = data.isHost;
    this.room = data.room || null;
    this.isReady = false;
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background
    this.cameras.main.setBackgroundColor('#e8f5e9');

    // Title
    this.add.text(width / 2, 50, '🐱 Waiting Room 🐱', {
      fontSize: '36px',
      fontFamily: 'Fredoka',
      color: '#5a4a3a',
    }).setOrigin(0.5);

    // Room code display
    this.add.text(width / 2, 100, 'Room Code:', {
      fontSize: '18px',
      fontFamily: 'Fredoka',
      color: '#8b7355',
    }).setOrigin(0.5);

    const codeDisplay = this.add.text(width / 2, 140, this.roomCode, {
      fontSize: '48px',
      fontFamily: 'Fredoka',
      color: '#ff6b6b',
      backgroundColor: '#fff',
      padding: { x: 30, y: 10 },
    }).setOrigin(0.5);

    // Copy button
    const copyBtn = this.add.text(width / 2 + 150, 140, '📋', {
      fontSize: '32px',
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => {
      navigator.clipboard.writeText(this.roomCode);
      this.statusText.setText('✅ Room code copied!');
      this.time.delayedCall(2000, () => {
        this.statusText.setText('');
      });
    });

    // Share instruction
    this.add.text(width / 2, 190, 'Share this code with your friend to play together!', {
      fontSize: '14px',
      fontFamily: 'Fredoka',
      color: '#8b7355',
    }).setOrigin(0.5);

    // Players section
    this.add.text(width / 2, 240, '👥 Players:', {
      fontSize: '24px',
      fontFamily: 'Fredoka',
      color: '#5a4a3a',
    }).setOrigin(0.5);

    // Player list area
    this.updatePlayerList();

    // Ready button
    this.readyButton = this.add.text(width / 2, 400, '✋ Ready!', {
      fontSize: '24px',
      fontFamily: 'Fredoka',
      color: '#fff',
      backgroundColor: '#4ecdc4',
      padding: { x: 40, y: 15 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => this.toggleReady());

    // Start button (host only)
    this.startButton = this.add.text(width / 2, 470, '🚀 Start Game!', {
      fontSize: '24px',
      fontFamily: 'Fredoka',
      color: '#fff',
      backgroundColor: '#95a5a6',
      padding: { x: 40, y: 15 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => this.startGame());

    this.startButton.setVisible(this.isHost);

    // Leave button
    const leaveBtn = this.add.text(100, height - 50, '👈 Leave', {
      fontSize: '18px',
      fontFamily: 'Fredoka',
      color: '#e74c3c',
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => this.leaveRoom());

    // Status text
    this.statusText = this.add.text(width / 2, height - 50, '', {
      fontSize: '16px',
      fontFamily: 'Fredoka',
      color: '#27ae60',
    }).setOrigin(0.5);

    // Decorative cats
    this.add.text(50, height / 2, '😺', { fontSize: '48px' });
    this.add.text(width - 80, height / 2, '😸', { fontSize: '48px' });

    // Setup socket callbacks
    this.setupSocketCallbacks();
  }

  private setupSocketCallbacks() {
    socketManager.onRoomUpdated = (room) => {
      this.room = room;
      this.updatePlayerList();
      this.updateStartButton();
    };

    socketManager.onPlayerJoined = (player) => {
      this.statusText.setText(`🎉 ${player.name} joined!`);
      this.time.delayedCall(3000, () => {
        if (this.statusText.text.includes(player.name)) {
          this.statusText.setText('');
        }
      });
    };

    socketManager.onPlayerLeft = (playerId) => {
      this.statusText.setText('😿 A player left the room');
    };

    socketManager.onGameStarted = (gameState) => {
      console.log('🎮 Game started! Switching to GameScene...', gameState);
      this.scene.start('GameScene', {
        playerId: this.playerId,
        playerName: this.playerName,
        roomCode: this.roomCode,
        initialState: gameState,
      });
    };

    socketManager.onError = (message) => {
      this.statusText.setText(`❌ ${message}`);
    };
  }

  private updatePlayerList() {
    // Clear existing player texts
    this.playerTexts.forEach(t => t.destroy());
    this.playerTexts = [];

    const { width } = this.cameras.main;
    const startY = 280;

    if (this.room) {
      this.room.players.forEach((player, index) => {
        const isMe = player.id === this.playerId;
        const isHost = player.id === this.room?.hostId;
        
        let displayText = `${isHost ? '👑 ' : ''}${player.name}${isMe ? ' (You)' : ''}`;
        let statusEmoji = player.isReady ? ' ✅' : ' ⏳';
        
        const text = this.add.text(width / 2, startY + index * 40, displayText + statusEmoji, {
          fontSize: '20px',
          fontFamily: 'Fredoka',
          color: isMe ? '#ff6b6b' : '#5a4a3a',
          backgroundColor: '#fff',
          padding: { x: 20, y: 8 },
        }).setOrigin(0.5);

        this.playerTexts.push(text);
      });

      // Show waiting message if only one player
      if (this.room.players.length < 2) {
        const waitText = this.add.text(width / 2, startY + 60, '⏳ Waiting for another player...', {
          fontSize: '16px',
          fontFamily: 'Fredoka',
          color: '#8b7355',
        }).setOrigin(0.5);
        this.playerTexts.push(waitText);
      }
    }
  }

  private updateStartButton() {
    if (!this.isHost || !this.room) {
      this.startButton.setVisible(false);
      return;
    }

    this.startButton.setVisible(true);

    const allReady = this.room.players.length >= 2 && 
                     this.room.players.every(p => p.isReady);

    if (allReady) {
      this.startButton.setStyle({ backgroundColor: '#27ae60' });
      this.startButton.setInteractive({ useHandCursor: true });
    } else {
      this.startButton.setStyle({ backgroundColor: '#95a5a6' });
    }
  }

  private toggleReady() {
    this.isReady = !this.isReady;
    socketManager.setReady(this.isReady);

    if (this.isReady) {
      this.readyButton.setText('❌ Not Ready');
      this.readyButton.setStyle({ backgroundColor: '#e74c3c' });
    } else {
      this.readyButton.setText('✋ Ready!');
      this.readyButton.setStyle({ backgroundColor: '#4ecdc4' });
    }
  }

  private startGame() {
    console.log('🚀 Start Game clicked!', this.room);
    if (!this.room || this.room.players.length < 2) {
      this.statusText.setText('❌ Need 2 players to start!');
      return;
    }

    const allReady = this.room.players.every(p => p.isReady);
    if (!allReady) {
      this.statusText.setText('❌ All players must be ready!');
      return;
    }

    console.log('🚀 Sending start-game to server...');
    socketManager.startGame();
  }

  private leaveRoom() {
    socketManager.leaveRoom();
    this.scene.start('MenuScene');
  }
}
