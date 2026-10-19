import type { HistoryCursor, HistoryPage, StoredSolve } from '../api/api';

export const HISTORY_BATCH = 50;
export type HistorySolve = StoredSolve & {pending?: boolean; cube_name?: string | null};

// Construct the next local midnight rather than adding 24 hours (DST days vary).
export function localDayInterval(day: string): {start: string; end: string} | null {
  if (!day) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('check dates');
  const [year, month, date] = day.split('-').map(Number);
  const start = new Date(year, month - 1, date);
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== date) throw new Error('check dates');
  return {start:start.toISOString(),end:new Date(year,month - 1,date + 1).toISOString()};
}

function newest(a: StoredSolve, b: StoredSolve): number {
  // Preserve sub-millisecond precision returned by the API before the ID tie-break.
  const fraction = (value: string) => (value.match(/\.(\d+)(?:Z|[+-]\d\d:\d\d)$/)?.[1] ?? '').padEnd(6,'0');
  return Date.parse(b.started_at) - Date.parse(a.started_at) || fraction(b.started_at).localeCompare(fraction(a.started_at)) || b.id.localeCompare(a.id);
}
function merge(rows: HistorySolve[], incoming: HistorySolve[]): HistorySolve[] {
  const records = new Map(rows.map(row => [row.id,row]));
  for (const row of incoming) records.set(row.id,row);
  return [...records.values()].sort(newest);
}
type Loader = (cursor: HistoryCursor | null, interval: ReturnType<typeof localDayInterval>, signal: AbortSignal) => Promise<HistoryPage>;

export class HistoryStore {
  rows: HistorySolve[] = [];
  cache: HistorySolve[] = [];
  day = '';
  opened = false;
  loading = false;
  error = false;
  cacheReady = false;
  hasMore = false;
  private cacheHasMore = false;
  private pageReady = false;
  private account: number | null = null;
  private revision = 0;
  private controller: AbortController | null = null;
  private failedKind: 'latest' | 'page' = 'latest';
  private load: Loader;
  private changed: () => void;

  constructor(load: Loader, changed: () => void) { this.load = load; this.changed = changed; }

  setAccount(account: number | null): void {
    this.cancel();
    this.account = account;
    this.cache = []; this.rows = []; this.day = '';
    this.cacheReady = false; this.cacheHasMore = false;
    this.pageReady = false;
    this.hasMore = false; this.error = false; this.opened = false;
    this.changed();
  }
  private cancel(): void {
    this.revision++;
    this.controller?.abort(); this.controller = null; this.loading = false;
  }
  open(): void {
    this.opened = true; this.day = ''; this.error = false;
    this.rows = [...this.cache]; this.hasMore = this.cacheHasMore;
    this.pageReady = this.cacheReady;
    this.changed();
    if (!this.cacheReady) void this.refreshLatest();
  }
  close(): void {
    this.cancel(); this.opened = false; this.day = ''; this.rows = [];
    this.hasMore = false; this.error = false; this.changed();
    this.pageReady = false;
  }
  filter(day: string): void {
    localDayInterval(day);
    this.cancel(); this.day = day; this.error = false;
    this.rows = day ? [] : [...this.cache];
    this.pageReady = !day && this.cacheReady;
    this.hasMore = day || !this.cacheReady ? true : this.cacheHasMore;
    this.changed();
    if (day) void this.fetch('page');
    else if (!this.cacheReady) void this.refreshLatest();
  }
  async refreshLatest(): Promise<void> {
    const revision = this.revision;
    await this.fetch('latest');
    if (revision === this.revision && this.opened && this.day && !this.pageReady && !this.error) await this.fetch('page');
  }
  more(): Promise<void> {
    if (!this.opened || !this.hasMore || this.error) return Promise.resolve();
    return this.fetch('page');
  }
  retry(): Promise<void> { return this.fetch(this.failedKind); }

  private async fetch(kind: 'latest' | 'page'): Promise<void> {
    if (this.account === null || this.loading) return;
    const revision = this.revision;
    const controller = new AbortController();
    this.controller = controller; this.loading = true; this.error = false; this.failedKind = kind;
    const last = this.rows.at(-1);
    const cursor = kind === 'page' && this.pageReady && last ? {started_at:last.started_at,id:last.id} : null;
    this.changed();
    try {
      const page = await this.load(cursor,kind === 'page' ? localDayInterval(this.day) : null,controller.signal);
      if (revision !== this.revision) return;
      if (kind === 'latest') {
        const pending = this.cache.filter(solve => solve.pending && !page.items.some(saved => saved.id === solve.id));
        const latest = merge(pending,page.items);
        this.cache = latest.slice(0,HISTORY_BATCH); this.cacheReady = true;
        this.cacheHasMore = page.next_cursor !== null || latest.length > HISTORY_BATCH;
        if (this.opened && !this.day) {
          const hadOlderPages = this.rows.length > HISTORY_BATCH;
          this.rows = hadOlderPages ? merge(this.rows,page.items) : [...this.cache];
          if (!hadOlderPages) this.hasMore = this.cacheHasMore;
          this.pageReady = true;
        }
      } else {
        this.rows = merge(this.rows,page.items); this.hasMore = page.next_cursor !== null;
        this.pageReady = true;
      }
    } catch {
      if (revision === this.revision) this.error = true;
    } finally {
      if (revision === this.revision) { this.loading = false; this.controller = null; this.changed(); }
    }
  }

  upsert(solve: HistorySolve): void {
    this.cancel();
    const latest = merge(this.cache,[solve]);
    if (latest.length > HISTORY_BATCH) this.cacheHasMore = true;
    this.cache = latest.slice(0,HISTORY_BATCH);
    const interval = localDayInterval(this.day);
    const matching = !interval || (Date.parse(solve.started_at) >= Date.parse(interval.start) && Date.parse(solve.started_at) < Date.parse(interval.end));
    if (this.opened && matching) {
      const last = this.rows.at(-1);
      if (!last || !this.hasMore || newest(solve,last) <= 0 || this.rows.some(row => row.id === solve.id)) {
        this.rows = merge(this.rows,[solve]);
      }
    }
    this.changed();
  }
  remove(id: string): void {
    this.cancel();
    this.cache = this.cache.filter(row => row.id !== id);
    this.rows = this.rows.filter(row => row.id !== id);
    this.changed();
  }
}
