import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

// Detect if mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                 window.matchMedia('(max-width: 768px)').matches ||
                 ('ontouchstart' in window);

// Calculate responsive dimensions
const getGameDimensions = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  
  if (isMobile) {
    return { width: w, height: h };
  }
  
  // Desktop: limit size but keep aspect ratio
  return { 
    width: Math.min(w, 1000), 
    height: Math.min(h, 700) 
  };
};

const dims = getGameDimensions();

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: dims.width,
  height: dims.height,
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
    mode: isMobile ? Phaser.Scale.RESIZE : Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: dims.width,
    height: dims.height,
  },
  input: {
    activePointers: 3,
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
