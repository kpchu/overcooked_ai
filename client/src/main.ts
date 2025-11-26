import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

// Detect if mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                 window.matchMedia('(max-width: 768px)').matches;

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: isMobile ? window.innerWidth : 900,
  height: isMobile ? window.innerHeight : 600,
  parent: 'game-container',
  backgroundColor: '#ffecd2',
  scene: [MenuScene, LobbyScene, GameScene, GameOverScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3, // Support multi-touch
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

// Remove loading screen
const loadingElement = document.querySelector('.loading');
if (loadingElement) {
  loadingElement.remove();
}

// Create game instance
const game = new Phaser.Game(config);

// Handle window resize
window.addEventListener('resize', () => {
  game.scale.refresh();
});

export default game;
