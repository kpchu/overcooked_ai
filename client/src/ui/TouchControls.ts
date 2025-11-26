import Phaser from 'phaser';

export interface TouchInput {
  direction: 'up' | 'down' | 'left' | 'right' | null;
  interact: boolean;
  drop: boolean;
}

export class TouchControls {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  
  // Joystick
  private joystickBase!: Phaser.GameObjects.Arc;
  private joystickThumb!: Phaser.GameObjects.Arc;
  private joystickPointer: Phaser.Input.Pointer | null = null;
  
  // Buttons
  private interactButton!: Phaser.GameObjects.Container;
  private dropButton!: Phaser.GameObjects.Container;
  
  // State
  private currentDirection: 'up' | 'down' | 'left' | 'right' | null = null;
  private interactPressed: boolean = false;
  private dropPressed: boolean = false;
  
  // Settings
  private joystickRadius = 50;
  private thumbRadius = 25;
  private deadzone = 10;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);

    this.createJoystick();
    this.createButtons();
    this.setupTouchHandlers();
  }

  private createJoystick() {
    const x = 100;
    const y = this.scene.cameras.main.height - 120;

    // Base circle
    this.joystickBase = this.scene.add.arc(x, y, this.joystickRadius, 0, 360, false, 0x000000, 0.3);
    this.joystickBase.setStrokeStyle(3, 0xffffff, 0.5);
    this.container.add(this.joystickBase);

    // Thumb circle
    this.joystickThumb = this.scene.add.arc(x, y, this.thumbRadius, 0, 360, false, 0xff6b6b, 0.8);
    this.joystickThumb.setStrokeStyle(2, 0xffffff, 0.8);
    this.container.add(this.joystickThumb);

    // Direction indicators
    const arrows = [
      { emoji: '▲', dx: 0, dy: -35 },
      { emoji: '▼', dx: 0, dy: 35 },
      { emoji: '◀', dx: -35, dy: 0 },
      { emoji: '▶', dx: 35, dy: 0 },
    ];
    
    arrows.forEach(({ emoji, dx, dy }) => {
      const arrow = this.scene.add.text(x + dx, y + dy, emoji, {
        fontSize: '16px',
        color: '#ffffff',
      }).setOrigin(0.5).setAlpha(0.5);
      this.container.add(arrow);
    });
  }

  private createButtons() {
    const baseX = this.scene.cameras.main.width - 80;
    const baseY = this.scene.cameras.main.height - 120;

    // Interact button (SPACE equivalent)
    this.interactButton = this.createButton(baseX - 60, baseY, '👆', 'Pick', 0x4ecdc4);
    this.container.add(this.interactButton);

    // Drop button (E equivalent)
    this.dropButton = this.createButton(baseX + 20, baseY - 60, '👇', 'Drop', 0xe74c3c);
    this.container.add(this.dropButton);
  }

  private createButton(x: number, y: number, emoji: string, label: string, color: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    
    // Button background
    const bg = this.scene.add.arc(0, 0, 35, 0, 360, false, color, 0.8);
    bg.setStrokeStyle(3, 0xffffff, 0.8);
    container.add(bg);

    // Emoji
    const icon = this.scene.add.text(0, -5, emoji, {
      fontSize: '24px',
    }).setOrigin(0.5);
    container.add(icon);

    // Label
    const text = this.scene.add.text(0, 18, label, {
      fontSize: '10px',
      fontFamily: 'Fredoka',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add(text);

    // Make interactive
    bg.setInteractive();

    return container;
  }

  private setupTouchHandlers() {
    // Joystick touch handling
    this.joystickBase.setInteractive();
    
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Check if touching joystick area
      const dx = pointer.x - this.joystickBase.x;
      const dy = pointer.y - this.joystickBase.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < this.joystickRadius * 2) {
        this.joystickPointer = pointer;
      }
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointer && pointer.id === this.joystickPointer.id) {
        this.updateJoystick(pointer);
      }
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointer && pointer.id === this.joystickPointer.id) {
        this.resetJoystick();
      }
    });

    // Button handlers
    const interactBg = this.interactButton.getAt(0) as Phaser.GameObjects.Arc;
    interactBg.on('pointerdown', () => {
      this.interactPressed = true;
      interactBg.setFillStyle(0x3dbdb5, 1);
    });
    interactBg.on('pointerup', () => {
      this.interactPressed = false;
      interactBg.setFillStyle(0x4ecdc4, 0.8);
    });
    interactBg.on('pointerout', () => {
      this.interactPressed = false;
      interactBg.setFillStyle(0x4ecdc4, 0.8);
    });

    const dropBg = this.dropButton.getAt(0) as Phaser.GameObjects.Arc;
    dropBg.on('pointerdown', () => {
      this.dropPressed = true;
      dropBg.setFillStyle(0xc0392b, 1);
    });
    dropBg.on('pointerup', () => {
      this.dropPressed = false;
      dropBg.setFillStyle(0xe74c3c, 0.8);
    });
    dropBg.on('pointerout', () => {
      this.dropPressed = false;
      dropBg.setFillStyle(0xe74c3c, 0.8);
    });
  }

  private updateJoystick(pointer: Phaser.Input.Pointer) {
    const baseX = this.joystickBase.x;
    const baseY = this.joystickBase.y;
    
    let dx = pointer.x - baseX;
    let dy = pointer.y - baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Clamp to joystick radius
    if (dist > this.joystickRadius) {
      dx = (dx / dist) * this.joystickRadius;
      dy = (dy / dist) * this.joystickRadius;
    }
    
    // Update thumb position
    this.joystickThumb.x = baseX + dx;
    this.joystickThumb.y = baseY + dy;
    
    // Determine direction (with deadzone)
    if (dist < this.deadzone) {
      this.currentDirection = null;
    } else {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      
      if (angle >= -45 && angle < 45) {
        this.currentDirection = 'right';
      } else if (angle >= 45 && angle < 135) {
        this.currentDirection = 'down';
      } else if (angle >= -135 && angle < -45) {
        this.currentDirection = 'up';
      } else {
        this.currentDirection = 'left';
      }
    }
  }

  private resetJoystick() {
    this.joystickPointer = null;
    this.joystickThumb.x = this.joystickBase.x;
    this.joystickThumb.y = this.joystickBase.y;
    this.currentDirection = null;
  }

  getInput(): TouchInput {
    const input: TouchInput = {
      direction: this.currentDirection,
      interact: this.interactPressed,
      drop: this.dropPressed,
    };
    
    // Reset button states after reading (for single press detection)
    // Keep them true while held down for continuous detection
    return input;
  }

  // Check if we should show touch controls
  static isTouchDevice(): boolean {
    return ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0) ||
           window.matchMedia('(pointer: coarse)').matches;
  }

  destroy() {
    this.container.destroy();
  }
}
