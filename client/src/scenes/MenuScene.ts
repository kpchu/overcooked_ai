import Phaser from 'phaser';
import { socketManager } from '../network/SocketManager';

export class MenuScene extends Phaser.Scene {
  private playerName: string = '';
  private roomCode: string = '';
  private nameInput!: HTMLInputElement;
  private codeInput!: HTMLInputElement;
  private statusText!: Phaser.GameObjects.Text;
  private isConnecting: boolean = false;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background
    this.cameras.main.setBackgroundColor('#ffecd2');
    
    // Title with cat emoji
    const title = this.add.text(width / 2, 80, '🐱 Cat Kitchen 🐱', {
      fontSize: '48px',
      fontFamily: 'Fredoka',
      color: '#5a4a3a',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, 130, 'A Purrfect Cooking Adventure!', {
      fontSize: '20px',
      fontFamily: 'Fredoka',
      color: '#8b7355',
    }).setOrigin(0.5);

    // Decorative cats
    this.add.text(100, height - 100, '😺', { fontSize: '64px' });
    this.add.text(width - 150, height - 100, '😸', { fontSize: '64px' });

    // Create HTML form elements
    this.createInputs();

    // Create buttons
    this.createButtons();

    // Status text
    this.statusText = this.add.text(width / 2, height - 50, '', {
      fontSize: '16px',
      fontFamily: 'Fredoka',
      color: '#d35400',
    }).setOrigin(0.5);

    // Setup socket callbacks
    this.setupSocketCallbacks();

    // Connect to server
    this.connectToServer();
  }

  private createInputs() {
    const { width, height } = this.cameras.main;
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;

    // Name input
    const nameLabel = document.createElement('div');
    nameLabel.innerHTML = 'Your Name:';
    nameLabel.style.cssText = `
      position: absolute;
      top: ${180}px;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Fredoka', sans-serif;
      font-size: 18px;
      color: #5a4a3a;
    `;
    gameContainer.appendChild(nameLabel);

    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Enter your name';
    this.nameInput.maxLength = 15;
    this.nameInput.style.cssText = `
      position: absolute;
      top: ${210}px;
      left: 50%;
      transform: translateX(-50%);
      width: 250px;
      padding: 12px 20px;
      font-size: 18px;
      font-family: 'Fredoka', sans-serif;
      border: 3px solid #ff9a9e;
      border-radius: 25px;
      outline: none;
      text-align: center;
      background: white;
    `;
    gameContainer.appendChild(this.nameInput);

    // Room code input
    const codeLabel = document.createElement('div');
    codeLabel.innerHTML = 'Room Code (to join):';
    codeLabel.style.cssText = `
      position: absolute;
      top: ${280}px;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Fredoka', sans-serif;
      font-size: 18px;
      color: #5a4a3a;
    `;
    gameContainer.appendChild(codeLabel);

    this.codeInput = document.createElement('input');
    this.codeInput.type = 'text';
    this.codeInput.placeholder = 'XXXXXX';
    this.codeInput.maxLength = 6;
    this.codeInput.style.cssText = `
      position: absolute;
      top: ${310}px;
      left: 50%;
      transform: translateX(-50%);
      width: 200px;
      padding: 12px 20px;
      font-size: 24px;
      font-family: 'Fredoka', sans-serif;
      border: 3px solid #a8e6cf;
      border-radius: 25px;
      outline: none;
      text-align: center;
      background: white;
      text-transform: uppercase;
      letter-spacing: 5px;
    `;
    gameContainer.appendChild(this.codeInput);
  }

  private createButtons() {
    const { width, height } = this.cameras.main;

    // Create Room button
    const createBtn = this.add.text(width / 2 - 130, 380, '🏠 Create Room', {
      fontSize: '20px',
      fontFamily: 'Fredoka',
      color: '#fff',
      backgroundColor: '#ff6b6b',
      padding: { x: 20, y: 15 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => createBtn.setStyle({ backgroundColor: '#ee5a5a' }))
    .on('pointerout', () => createBtn.setStyle({ backgroundColor: '#ff6b6b' }))
    .on('pointerdown', () => this.handleCreateRoom());

    // Join Room button
    const joinBtn = this.add.text(width / 2 + 130, 380, '🚪 Join Room', {
      fontSize: '20px',
      fontFamily: 'Fredoka',
      color: '#fff',
      backgroundColor: '#4ecdc4',
      padding: { x: 20, y: 15 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => joinBtn.setStyle({ backgroundColor: '#3dbdb5' }))
    .on('pointerout', () => joinBtn.setStyle({ backgroundColor: '#4ecdc4' }))
    .on('pointerdown', () => this.handleJoinRoom());

    // How to play text
    this.add.text(width / 2, 450, '🎮 How to Play:', {
      fontSize: '18px',
      fontFamily: 'Fredoka',
      color: '#5a4a3a',
    }).setOrigin(0.5);

    this.add.text(width / 2, 485, 'WASD or Arrow Keys to move\nSPACE to interact/pick up\nE to drop items', {
      fontSize: '14px',
      fontFamily: 'Fredoka',
      color: '#8b7355',
      align: 'center',
    }).setOrigin(0.5);
  }

  private async connectToServer() {
    this.statusText.setText('Connecting to server...');
    this.isConnecting = true;

    try {
      await socketManager.connect();
      this.statusText.setText('✅ Connected! Enter your name to play.');
      this.isConnecting = false;
    } catch (error) {
      this.statusText.setText('❌ Failed to connect. Please refresh.');
      this.isConnecting = false;
    }
  }

  private setupSocketCallbacks() {
    socketManager.onRoomCreated = (data) => {
      this.cleanupInputs();
      this.scene.start('LobbyScene', { 
        roomCode: data.code, 
        playerId: data.playerId,
        playerName: this.playerName,
        isHost: true 
      });
    };

    socketManager.onRoomJoined = (data) => {
      this.cleanupInputs();
      this.scene.start('LobbyScene', { 
        roomCode: data.room.code, 
        playerId: data.playerId,
        playerName: this.playerName,
        isHost: false,
        room: data.room
      });
    };

    socketManager.onError = (message) => {
      this.statusText.setText(`❌ ${message}`);
    };
  }

  private handleCreateRoom() {
    this.playerName = this.nameInput.value.trim();
    if (!this.playerName) {
      this.statusText.setText('❌ Please enter your name!');
      this.nameInput.focus();
      return;
    }

    if (!socketManager.isConnected) {
      this.statusText.setText('❌ Not connected to server. Please wait...');
      return;
    }

    this.statusText.setText('Creating room...');
    socketManager.createRoom(this.playerName);
  }

  private handleJoinRoom() {
    this.playerName = this.nameInput.value.trim();
    this.roomCode = this.codeInput.value.trim().toUpperCase();

    if (!this.playerName) {
      this.statusText.setText('❌ Please enter your name!');
      this.nameInput.focus();
      return;
    }

    if (!this.roomCode || this.roomCode.length !== 6) {
      this.statusText.setText('❌ Please enter a valid 6-character room code!');
      this.codeInput.focus();
      return;
    }

    if (!socketManager.isConnected) {
      this.statusText.setText('❌ Not connected to server. Please wait...');
      return;
    }

    this.statusText.setText('Joining room...');
    socketManager.joinRoom(this.roomCode, this.playerName);
  }

  private cleanupInputs() {
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      const inputs = gameContainer.querySelectorAll('input, div:not(#game-container):not(.loading)');
      inputs.forEach(el => {
        if (el.parentNode === gameContainer) {
          el.remove();
        }
      });
    }
  }

  shutdown() {
    this.cleanupInputs();
  }
}
