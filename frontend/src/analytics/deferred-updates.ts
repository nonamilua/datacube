export type AnalyticsView = 'overview' | 'compare';

// Filters live in their controls; invalidating results never changes selections.
export class DeferredAnalyticsUpdates {
  private visible = false;
  private view: AnalyticsView = 'overview';
  private stale = {overview:true,compare:true};
  private render: (view: AnalyticsView) => void;

  constructor(render: (view: AnalyticsView) => void) { this.render = render; }

  isActive(view: AnalyticsView): boolean { return this.visible && this.view === view; }
  invalidate(view?: AnalyticsView): boolean {
    if (view) this.stale[view] = true;
    else this.stale.overview = this.stale.compare = true;
    return this.flush();
  }
  show(rolling = false): boolean {
    this.visible = true;
    if (rolling) this.stale.overview = this.stale.compare = true;
    return this.flush();
  }
  hide(): void { this.visible = false; }
  select(view: AnalyticsView): boolean { this.view = view; return this.flush(); }
  reset(visible = false): void {
    this.visible = visible; this.view = 'overview';
    this.stale.overview = this.stale.compare = true;
  }
  private flush(): boolean {
    if (!this.visible || !this.stale[this.view]) return false;
    this.stale[this.view] = false;
    try { this.render(this.view); }
    catch (error) { this.stale[this.view] = true; throw error; }
    return true;
  }
}
