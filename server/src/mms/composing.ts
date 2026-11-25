import { COMPOSING_TTL_MS, type Composer } from "@alliance/common/mmsThreads";

/** Who is composing to which number, per socket, so one admin's tabs each
 * keep their own report and a closed tab drops only its own. */
export class ComposingRegistry {
  private readonly reports = new Map<
    string,
    { composer: Composer; expiry: NodeJS.Timeout }
  >();

  constructor(private readonly onChange: () => void) {}

  report(socketId: string, composer: Composer): void {
    const key = `${socketId}:${composer.phoneNumber}`;
    const existing = this.reports.get(key);
    if (existing) clearTimeout(existing.expiry);
    const expiry = setTimeout(() => this.drop([key]), COMPOSING_TTL_MS);
    this.reports.set(key, { composer, expiry });
    if (!existing) this.onChange();
  }

  stop(socketId: string, phoneNumber: string): void {
    this.drop([`${socketId}:${phoneNumber}`]);
  }

  disconnect(socketId: string): void {
    this.drop(
      [...this.reports.keys()].filter((key) => key.startsWith(`${socketId}:`)),
    );
  }

  /** One entry per admin and number, however many of the admin's tabs report. */
  composers(): Composer[] {
    const unique = new Map<string, Composer>();
    for (const { composer } of this.reports.values()) {
      unique.set(`${composer.adminId}:${composer.phoneNumber}`, composer);
    }
    return [...unique.values()];
  }

  clear(): void {
    for (const { expiry } of this.reports.values()) clearTimeout(expiry);
    this.reports.clear();
  }

  private drop(keys: string[]): void {
    let changed = false;
    for (const key of keys) {
      const report = this.reports.get(key);
      if (!report) continue;
      clearTimeout(report.expiry);
      this.reports.delete(key);
      changed = true;
    }
    if (changed) this.onChange();
  }
}
