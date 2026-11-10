import type { AgentEvent, AgentEventListener } from "./session";

export class SessionListeners {
  private readonly subscriptions = new Set<{ listener: AgentEventListener }>();

  constructor(private readonly sessionId: string) {}

  subscribe(listener: AgentEventListener): () => void {
    const subscription = { listener };
    this.subscriptions.add(subscription);
    return () => this.subscriptions.delete(subscription);
  }

  emit(event: AgentEvent): void {
    for (const subscription of [...this.subscriptions]) {
      if (!this.subscriptions.has(subscription)) continue;
      try {
        subscription.listener(event);
      } catch (error) {
        console.error(
          `session ${this.sessionId} listener threw on ${event.kind}`,
          error,
        );
      }
    }
  }
}
