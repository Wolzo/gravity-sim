export class EventBus {
  /**
   * Simple Pub/Sub system to decouple Simulation, Renderer, and UI.
   */
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event).push(callback);

    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const idx = callbacks.indexOf(callback);

    if (idx !== -1) {
      callbacks.splice(idx, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;

    const callbacks = [...this.listeners.get(event)];

    for (const cb of callbacks) {
      cb(data);
    }
  }

  clear() {
    this.listeners.clear();
  }
}
