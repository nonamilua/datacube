export const scrambleEvents: Record<string, string> = {
  '2x2':'222', '3x3':'333', '4x4':'444', '5x5':'555', '6x6':'666', '7x7':'777',
  '3bld':'333bf', '4bld':'444bf', '5bld':'555bf', '3oh':'333oh', '3mbld':'333mbf',
  'fmc':'333fm', 'clock':'clock', 'megaminx':'minx', 'pyraminx':'pyram',
  'skewb':'skewb', 'square 1':'sq1', 'fto':'fto',
};

export interface ScrambleSnapshot { readonly event: string; readonly text: string }
export type ScrambleGenerator = (eventID: string) => Promise<string>;

let library: Promise<typeof import('cubing/scramble')> | undefined;
export const generateScramble: ScrambleGenerator = async eventID => {
  library ??= (async () => {
    const {setSearchDebug} = await import('cubing/search');
    // Do not generate unrequested scrambles after the toggle is turned off.
    setSearchDebug({scramblePrefetchLevel:'none', logPerf:false, prioritizeEsbuildWorkaroundForWorkerInstantiation:true});
    return import('cubing/scramble');
  })();
  const {randomScrambleForEvent} = await library;
  return (await randomScrambleForEvent(eventID)).toString();
};

// Account/event revisions invalidate requests without blocking the interface.
export class Scrambles {
  enabled = false;
  event = '';
  status: 'off' | 'loading' | 'ready' | 'failed' = 'off';
  text = '';
  private account: number | null = null;
  private revision = 0;
  private notify: () => void;
  private generate: ScrambleGenerator;

  constructor(notify: () => void, generate: ScrambleGenerator = generateScramble) {
    this.notify = notify;
    this.generate = generate;
  }

  configure(account: number | null, event: string, enabled: boolean): void {
    enabled = enabled && account !== null;
    if (account === this.account && event === this.event && enabled === this.enabled) return;
    this.account = account;
    this.event = event;
    this.enabled = enabled;
    this.revision++;
    this.text = '';
    this.status = 'off';
    this.notify();
    if (enabled) void this.replace();
  }

  get canStart(): boolean { return !this.enabled || this.status === 'ready'; }

  capture(): ScrambleSnapshot | null {
    if (!this.enabled) return null;
    if (!this.canStart) throw new Error('scramble not ready');
    return Object.freeze({event:this.event, text:this.text});
  }

  async replace(): Promise<void> {
    if (!this.enabled) return;
    const revision = ++this.revision;
    this.text = '';
    this.status = 'loading';
    this.notify();
    try {
      const eventID = scrambleEvents[this.event];
      if (!eventID) throw new Error('unsupported event');
      const text = await this.generate(eventID);
      if (revision !== this.revision) return;
      if (!text.trim()) throw new Error('empty scramble');
      this.text = text;
      this.status = 'ready';
    } catch (error) {
      if (revision !== this.revision) return;
      console.warn('scramble generation failed', error);
      this.status = 'failed';
    }
    this.notify();
  }
}
