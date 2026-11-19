export class InputManager {
  private readonly keys = new Set<string>();
  private pointerDeltaX = 0;
  private pointerDeltaY = 0;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private joystickPointer: number | null = null;
  private mouseLookActive = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private readonly touchStart = new Map<number, { x: number; y: number }>();
  private readonly touchActionListeners = new Map<HTMLElement, (event: PointerEvent) => void>();
  attackPressed = false;
  jumpPressed = false;
  blockHeld = false;
  interactPressed = false;
  spiritPressed = false;
  inventoryPressed = false;
  cameraPressed = false;
  sprintHeld = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (event.code === 'Space') this.jumpPressed = true;
    if (event.code === 'KeyE') this.interactPressed = true;
    if (event.code === 'KeyQ') this.spiritPressed = true;
    if (event.code === 'KeyI') this.inventoryPressed = true;
    if (event.code === 'KeyV') this.cameraPressed = true;
  };
  private readonly onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };
  private readonly onPointerDown = (event: PointerEvent): void => {
    const target = event.target as HTMLElement;
    if (target.closest('.touch-controls')) {
      this.touchStart.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (target.closest('.joystick')) this.joystickPointer = event.pointerId;
    } else if (event.pointerType === 'mouse' && event.target === this.pointerLockElement) {
      this.mouseLookActive = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (event.pointerType !== 'mouse') {
      this.touchStart.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
  };
  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && document.pointerLockElement === this.pointerLockElement) {
      this.pointerDeltaX += event.movementX;
      this.pointerDeltaY += event.movementY;
    } else if (event.pointerType === 'mouse' && this.mouseLookActive) {
      this.pointerDeltaX += event.clientX - this.lastMouseX;
      this.pointerDeltaY += event.clientY - this.lastMouseY;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (this.joystickPointer === event.pointerId) {
      const start = this.touchStart.get(event.pointerId);
      if (start) {
        this.touchMoveX = Math.max(-1, Math.min(1, (event.clientX - start.x) / 42));
        this.touchMoveY = Math.max(-1, Math.min(1, (event.clientY - start.y) / 42));
        const thumb = this.element.querySelector<HTMLElement>('.joystick span');
        if (thumb) thumb.style.transform = `translate(calc(-50% + ${this.touchMoveX * 28}px), calc(-50% + ${this.touchMoveY * 28}px))`;
      }
    } else if (event.pointerType !== 'mouse' && this.touchStart.has(event.pointerId)) {
      const start = this.touchStart.get(event.pointerId)!;
      this.pointerDeltaX += event.clientX - start.x;
      this.pointerDeltaY += event.clientY - start.y;
      this.touchStart.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
  };
  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') this.mouseLookActive = false;
    this.endPointer(event.pointerId);
  };
  private readonly onContextMenu = (event: MouseEvent): void => { event.preventDefault(); };

  constructor(private readonly element: HTMLElement, private readonly pointerLockElement: HTMLElement = element) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerEnd);
    window.addEventListener('pointercancel', this.onPointerEnd);
    this.element.addEventListener('contextmenu', this.onContextMenu);
  }

  private endPointer(id: number): void {
    this.touchStart.delete(id);
    if (this.joystickPointer === id) {
      this.joystickPointer = null;
      this.touchMoveX = 0;
      this.touchMoveY = 0;
      const thumb = this.element.querySelector<HTMLElement>('.joystick span');
      if (thumb) thumb.style.transform = 'translate(-50%, -50%)';
    }
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  move(): { x: number; y: number } {
    const x = Number(this.isDown('KeyD')) - Number(this.isDown('KeyA')) + this.touchMoveX;
    const y = Number(this.isDown('KeyS')) - Number(this.isDown('KeyW')) + this.touchMoveY;
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  takeLookDelta(): { x: number; y: number } {
    const result = { x: this.pointerDeltaX, y: this.pointerDeltaY };
    this.pointerDeltaX = 0;
    this.pointerDeltaY = 0;
    return result;
  }

  attachTouchAction(button: HTMLElement, action: () => void): void {
    const previous = this.touchActionListeners.get(button);
    if (previous) button.removeEventListener('pointerdown', previous);
    const listener = (event: PointerEvent): void => {
      event.preventDefault();
      action();
    };
    button.addEventListener('pointerdown', listener);
    this.touchActionListeners.set(button, listener);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerEnd);
    window.removeEventListener('pointercancel', this.onPointerEnd);
    this.element.removeEventListener('contextmenu', this.onContextMenu);
    for (const [button, listener] of this.touchActionListeners) {
      button.removeEventListener('pointerdown', listener);
    }
    this.touchActionListeners.clear();
    this.keys.clear();
    this.touchStart.clear();
    this.joystickPointer = null;
    this.mouseLookActive = false;
  }
}
