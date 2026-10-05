export type TimerState = 'IDLE' | 'HOLDING' | 'READY' | 'RUNNING' | 'STOPPED';
export interface Solve { duration_ms: number; started_at: string }

// The monotonic clock measures duration; the wall clock only records the date.
export class SolveTimer {
  state: TimerState = 'IDLE';
  readonly holdDuration = 400;
  private heldAt = 0;
  private runningAt = 0;
  private startedAt = '';
  private lastDuration = 0;
  private previousState: TimerState = 'IDLE';

  reset(): void {
    this.state = 'IDLE';
    this.previousState = 'IDLE';
    this.heldAt = 0;
    this.runningAt = 0;
    this.startedAt = '';
    this.lastDuration = 0;
  }

  prepare(now = performance.now()): void {
    if (this.state !== 'IDLE' && this.state !== 'STOPPED') return;
    this.previousState = this.state;
    this.heldAt = now;
    this.state = 'HOLDING';
  }

  update(now = performance.now()): void {
    if (this.state === 'HOLDING' && now - this.heldAt >= this.holdDuration) this.state = 'READY';
  }

  release(now = performance.now()): void {
    this.update(now);
    if (this.state === 'READY') {
      this.runningAt = now;
      this.startedAt = new Date().toISOString();
      this.state = 'RUNNING';
    } else this.cancelPreparation();
  }

  cancelPreparation(): void {
    if (this.state === 'HOLDING' || this.state === 'READY') this.state = this.previousState;
  }

  elapsed(now = performance.now()): number {
    return this.state === 'RUNNING' ? Math.max(0, now - this.runningAt) : this.lastDuration;
  }

  stop(now = performance.now()): Solve | null {
    if (this.state !== 'RUNNING') return null;
    this.lastDuration = Math.round(this.elapsed(now));
    this.state = 'STOPPED';
    return { duration_ms: this.lastDuration, started_at: this.startedAt };
  }
}

export function formatTime(milliseconds: number): string {
  const centiseconds = Math.floor(milliseconds / 10);
  const seconds = Math.floor(centiseconds / 100);
  const fraction = String(centiseconds % 100).padStart(2, '0');
  return seconds < 60 ? `${seconds}.${fraction}` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${fraction}`;
}
