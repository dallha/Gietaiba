type Listener = () => void;

class EventBus {
  private listeners: Record<string, Listener[]> = {};

  on(event: string, listener: Listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
  }

  emit(event: string) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(l => l());
    }
  }
}

export const eventBus = new EventBus();
