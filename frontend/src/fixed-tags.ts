// Only the switch preference is persisted; the remembered tag is session-local.
export class FixedTags {
  private account: number | null = null;
  private event: number | null = null;
  private enabled = false;
  private custom: string | null = null;
  private revision = 0;

  configure(account: number | null, event: number | null, enabled: boolean): void {
    if (account !== this.account || event !== this.event || enabled !== this.enabled) {
      this.custom = null;
      this.revision += 1;
    }
    this.account = account;
    this.event = event;
    this.enabled = enabled;
  }

  get version(): number { return this.revision; }
  get value(): string | null { return this.enabled && this.account !== null ? this.custom : null; }

  remember(event: number | null | undefined, custom: string | null | undefined, version: number): void {
    // Ignore edits to other events and confirmations from an old account/event context.
    if (this.enabled && this.account !== null && this.event !== null && event === this.event && version === this.revision) {
      this.custom = custom ?? null;
    }
  }
}
