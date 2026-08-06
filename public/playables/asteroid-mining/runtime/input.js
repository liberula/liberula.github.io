// input.js
// Pointer input for Canvas playable, kept deterministic and frame-consumable.
// Client coordinates are normalized through the canvas bounds into logical game space.

export class Input {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.logicalWidth = options.logicalWidth ?? null;
    this.logicalHeight = options.logicalHeight ?? null;

    this.activePointerId = null;

    this.isPointerDown = false;
    this.holdTime = 0;

    this.pointerX = 0; // logical coordinates
    this.pointerY = 0; // logical coordinates
    this.pointerStartX = 0;
    this.pointerStartY = 0;

    this.pointerDownEvents = [];
    this.pointerUpEvents = [];
    this.pointerCancelEvents = [];

    this._bindEvents();
  }

  _bindEvents() {
    // Prevent default browser gestures
    this.canvas.addEventListener("dblclick", e => e.preventDefault());
    this.canvas.addEventListener("contextmenu", e => e.preventDefault());

    this.canvas.addEventListener("pointerdown", e => this._onPointerDown(e), { passive: false });
    this.canvas.addEventListener("pointerup", e => this._onPointerUp(e));
    this.canvas.addEventListener("pointercancel", e => this._onPointerCancel(e));
    this.canvas.addEventListener("pointermove", e => this._onPointerMove(e), { passive: false });
  }

  update(dt) {
    if (this.isPointerDown) {
      this.holdTime += dt;
    }
  }

  consumePointerDown() {
    return this.pointerDownEvents.shift() ?? null;
  }

  consumePointerUp() {
    return this.pointerUpEvents.shift() ?? null;
  }

  consumePointerCancel() {
    return this.pointerCancelEvents.shift() ?? null;
  }

  _onPointerDown(event) {
    event.preventDefault();

    if (this.activePointerId !== null) return;

    this.activePointerId = event.pointerId;
    this.isPointerDown = true;
    this.holdTime = 0;

    const position = this._getLogicalPosition(event);
    this.pointerX = position.x;
    this.pointerY = position.y;
    this.pointerStartX = position.x;
    this.pointerStartY = position.y;
    this.pointerDownEvents.push(this._createPointerEvent(event, position.x, position.y));

    if (event.target === this.canvas) {
      this.canvas.setPointerCapture(event.pointerId);
    }
  }

  _onPointerUp(event) {
    if (!this._isValidPointer(event)) return;

    const position = this._getLogicalPosition(event);
    this.pointerX = position.x;
    this.pointerY = position.y;
    this.pointerUpEvents.push(this._createPointerEvent(event, position.x, position.y));
    this._resetPointer(event);
  }

  _onPointerCancel(event) {
    if (!this._isValidPointer(event)) return;
    const position = this._getLogicalPosition(event);
    this.pointerX = position.x;
    this.pointerY = position.y;
    this.pointerCancelEvents.push(this._createPointerEvent(event, position.x, position.y));
    this._resetPointer(event);
  }

  _onPointerMove(event) {
    if (event.pointerId !== this.activePointerId) return;

    const position = this._getLogicalPosition(event);
    this.pointerX = position.x;
    this.pointerY = position.y;

    // Re-capture if needed
    if (this.isPointerDown && !this.canvas.hasPointerCapture(this.activePointerId)) {
      if (event.target === this.canvas) {
        this.canvas.setPointerCapture(event.pointerId);
      }
    }
  }

  _isValidPointer(event) {
    return event.pointerId === this.activePointerId;
  }

  _createPointerEvent(event, x, y) {
    return {
      pointerId: event.pointerId,
      x,
      y,
      startX: this.pointerStartX,
      startY: this.pointerStartY
    };
  }

  _getLogicalPosition(event) {
    if (!this.logicalWidth || !this.logicalHeight || !this.canvas.getBoundingClientRect) {
      return { x: event.clientX, y: event.clientY };
    }

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };

    return {
      x: ((event.clientX - rect.left) / rect.width) * this.logicalWidth,
      y: ((event.clientY - rect.top) / rect.height) * this.logicalHeight
    };
  }

  _resetPointer(event) {
    if (this.activePointerId === null) return;

    if (this.isPointerDown && this.canvas.hasPointerCapture(this.activePointerId)) {
      this.canvas.releasePointerCapture(this.activePointerId);
    }

    this.isPointerDown = false;
    this.holdTime = 0;
    this.activePointerId = null;
  }
}
