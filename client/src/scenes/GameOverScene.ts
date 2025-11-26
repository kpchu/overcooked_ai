import Phaser from 'phaser';
import { socketManager } from '../network/SocketManager';

interface GameOverData {
  score: number;
  won: boolean;
  roomCode: string;
}

export class GameOverScene extends Phaser.Scene {
  private score: number = 0;
  private won: boolean = false;
  private roomCode: string = '';

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: GameOverData) {
    this.score = data.score;
    this.won = data.won;
    this.roomCode = data.roomCode;
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background
    this.cameras.main.setBackgroundColor(this.won ? '#a8e6cf' : '#ffaaa5');

    // Result title
    const resultText = this.won ? '🎉 Purrfect! 🎉' : '😿 Time\'s Up!';
    this.add.text(width / 2, 100, resultText, {
      fontSize: '48px',
      fontFamily: 'Fredoka',
      color: '#5a4a3a',
    }).setOrigin(0.5);

    // Cat reaction
    const catEmoji = this.won ? '😻' : '🙀';
    this.add.text(width / 2, 180, catEmoji, { fontSize: '80px' }).setOrigin(0.5);

    // Score
    this.add.text(width / 2, 280, 'Final Score', {
      fontSize: '24px',
      fontFamily: 'Fredoka',
      color: '#8b7355',
    }).setOrigin(0.5);

    this.add.text(width / 2, 330, `${this.score}`, {
      fontSize: '72px',
      fontFamily: 'Fredoka',
      color: '#5a4a3a',
    }).setOrigin(0.5);

    // Stars based on score
    const stars = this.getStars();
    this.add.text(width / 2, 400, stars, { fontSize: '48px' }).setOrigin(0.5);

    // Play again button
    const playAgainBtn = this.add.text(width / 2, 480, '🔄 Play Again', {
      fontSize: '24px',
      fontFamily: 'Fredoka',
      color: '#fff',
      backgroundColor: '#4ecdc4',
      padding: { x: 30, y: 15 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => playAgainBtn.setStyle({ backgroundColor: '#3dbdb5' }))
    .on('pointerout', () => playAgainBtn.setStyle({ backgroundColor: '#4ecdc4' }))
    .on('pointerdown', () => {
      socketManager.leaveRoom();
      this.scene.start('MenuScene');
    });

    // Decorative cats
    this.add.text(50, height - 100, '😺', { fontSize: '48px' });
    this.add.text(width - 100, height - 100, '😸', { fontSize: '48px' });

    // Message
    const message = this.won 
      ? 'Great teamwork! You make a purrfect team! 🐱' 
      : 'Don\'t worry, practice makes purrfect! 🐱';
    this.add.text(width / 2, height - 60, message, {
      fontSize: '16px',
      fontFamily: 'Fredoka',
      color: '#5a4a3a',
    }).setOrigin(0.5);
  }

  private getStars(): string {
    if (this.score >= 100) return '⭐⭐⭐';
    if (this.score >= 50) return '⭐⭐☆';
    if (this.score >= 20) return '⭐☆☆';
    return '☆☆☆';
  }
}
