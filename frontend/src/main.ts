import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/main.css';
import { SolveTimer, formatTime, type Solve } from './timer/timer';
import { bindControls } from './timer/controls';
import { loadSolves, pendingSolves, queueSolve, savePendingSolves } from './api/api';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
}
const timer = new SolveTimer();
const area = element<HTMLButtonElement>('timer-area');
const value = element('timer-value');
const hint = element('timer-hint');
const hidden = element<HTMLInputElement>('hidden-time');
const solves: Solve[] = [];
let solveCount = 0;
let syncing = false;
const storageStatus = element('storage-status');

function solveRow(solve: Solve): HTMLLIElement {
  const row = document.createElement('li');
  const result = document.createElement('strong');
  result.textContent = formatTime(solve.duration_ms);
  const time = document.createElement('time');
  time.dateTime = solve.started_at;
  time.textContent = new Date(solve.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  row.append(result, time);
  return row;
}

function renderSolves(): void {
  element('empty-message').hidden = solveCount > 0;
  element('solve-count').textContent = `${solveCount} ${solveCount === 1 ? 'solve' : 'solves'}`;
  element('recent-solves').replaceChildren(...solves.slice(0, 10).map(solveRow));
}

async function syncSolves(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    if (pendingSolves().length) {
      storageStatus.hidden = false;
      storageStatus.textContent = 'saving';
    }
    // Repeat if another solve was queued while a request was in flight.
    let page;
    do {
      await savePendingSolves();
      page = await loadSolves();
    } while (pendingSolves().length);
    solves.splice(0, solves.length, ...page.items);
    solveCount = page.total;
    renderSolves();
    storageStatus.hidden = true;
  } catch {
    storageStatus.textContent = 'connection unavailable';
  } finally {
    syncing = false;
  }
}

bindControls(timer, area, (solve) => {
  value.animate([{ color: 'var(--ready)' }, { color: 'var(--ready)' }], { duration: 300 });
  solves.unshift(solve);
  solveCount += 1;
  renderSolves();
  element('announcement').textContent = `solve ${formatTime(solve.duration_ms)}`;
  try {
    queueSolve(solve);
    void syncSolves();
  } catch {
    storageStatus.hidden = false;
    storageStatus.textContent = 'save unavailable';
  }
});
try {
  solves.push(...pendingSolves().sort((a, b) => b.started_at.localeCompare(a.started_at)));
  solveCount = solves.length;
  renderSolves();
  void syncSolves();
} catch {
  storageStatus.hidden = false;
  storageStatus.textContent = 'storage unavailable';
}
window.addEventListener('online', () => void syncSolves());
window.setInterval(() => void syncSolves(), 15000);
const timerTab = element<HTMLButtonElement>('timer-tab');
const analysisTab = element<HTMLButtonElement>('analysis-tab');
const settings = element<HTMLDetailsElement>('settings-panel');
document.addEventListener('click', (event) => {
  if (event.target instanceof Node && !settings.contains(event.target)) settings.open = false;
});
function showPanel(analysis: boolean): void {
  settings.open = false;
  timer.cancelPreparation();
  element('timer-panel').hidden = analysis;
  element('analysis-panel').hidden = !analysis;
  const active = analysis ? analysisTab : timerTab;
  const inactive = analysis ? timerTab : analysisTab;
  active.setAttribute('aria-current', 'page');
  inactive.removeAttribute('aria-current');
}
timerTab.addEventListener('click', () => showPanel(false));
analysisTab.addEventListener('click', () => showPanel(true));

let lastState = '';
function render(): void {
  timer.update();
  const running = timer.state === 'RUNNING';
  value.textContent = running && hidden.checked ? 'solving' : formatTime(timer.elapsed());
  value.classList.toggle('hidden-value', running && hidden.checked);
  area.dataset.state = timer.state;
  hidden.disabled = analysisTab.disabled = running || timer.state === 'HOLDING' || timer.state === 'READY';
  const labels = {
    IDLE: 'hold to start',
    HOLDING: 'hold',
    READY: 'release',
    RUNNING: 'any key to stop',
    STOPPED: 'hold to start',
  };
  hint.textContent = labels[timer.state];
  if (timer.state !== lastState) {
    if (timer.state === 'READY') element('announcement').textContent = 'release to start';
    lastState = timer.state;
  }
  requestAnimationFrame(render);
}
render();
