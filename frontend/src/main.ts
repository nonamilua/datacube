import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/main.css';
import { SolveTimer, formatTime, type Solve } from './timer/timer';
import { bindControls } from './timer/controls';
import { ApiError, deleteSolve, loadSolves, pendingSolves, queueSolve, request, savePendingSolves, type Organization, type StoredSolve, type User } from './api/api';
import { setupAccounts } from './accounts';
import { icon } from './icons';

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
type DisplaySolve = Solve & Partial<StoredSolve> & { pending?: boolean };
const solves: DisplaySolve[] = [];
let solveCount = 0;
let syncing = false;
let deleting = false;
const storageStatus = element('storage-status');
const eventSelect = element<HTMLSelectElement>('event-select');
const cubeName = element<HTMLInputElement>('cube-name');
let user: User | null = null;
let organization: Organization = { categories: [], cubes: [] };
const preferencesKey = () => `namicubes settings ${user!.id}`;
element('timer-tab').append(icon('timer'));
element('analysis-tab').append(icon('analysis'));
element('settings-panel').querySelector('summary')!.append(icon('settings'));

function solveRow(solve: DisplaySolve): HTMLLIElement {
  const row = document.createElement('li');
  const result = document.createElement('strong');
  result.textContent = formatTime(solve.duration_ms);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete-solve icon-button';
  remove.setAttribute('aria-label', `delete solve ${formatTime(solve.duration_ms)}`);
  remove.title = 'delete solve';
  remove.disabled = !solve.id || Boolean(solve.pending) || syncing || deleting;
  remove.append(icon('trash'));
  remove.addEventListener('click', () => void removeSolve(solve));
  row.append(result, remove);
  const labeled = solve as Solve & { category_id?: number; cube_id?: number; cube_name?: string };
  const event = organization.categories.find(item => item.id === labeled.category_id)?.name;
  const cube = labeled.cube_name ?? organization.cubes.find(item => item.id === labeled.cube_id)?.name;
  if (event || cube) {
    const labels = document.createElement('span');
    labels.className = 'solve-labels';
    labels.textContent = [event, cube].filter(Boolean).join(' ');
    row.insertBefore(labels, remove);
  }
  return row;
}

async function removeSolve(solve: DisplaySolve): Promise<void> {
  if (!solve.id || solve.pending || !user || syncing || deleting) return;
  const activeUser = user;
  deleting = true;
  renderSolves();
  let removed = false;
  try {
    await deleteSolve(solve.id, activeUser.id);
    if (user !== activeUser) return;
    const index = solves.findIndex(item => item.id === solve.id);
    if (index !== -1) solves.splice(index, 1);
    solveCount = Math.max(0, solveCount - 1);
    storageStatus.hidden = true;
    element('announcement').textContent = 'solve deleted';
    removed = true;
  } catch (error) {
    if (user !== activeUser) return;
    storageStatus.hidden = false;
    storageStatus.textContent = 'delete unavailable';
    if (error instanceof ApiError && (error.status === 401 || error.status === 409)) accounts.requireLogin();
  } finally {
    deleting = false;
    if (user === activeUser) renderSolves();
  }
  if (removed) void syncSolves();
}

function renderSolves(): void {
  element('empty-message').hidden = solveCount > 0;
  element('solve-count').textContent = `${solveCount} ${solveCount === 1 ? 'solve' : 'solves'}`;
  element('recent-solves').replaceChildren(...solves.slice(0, 10).map(solveRow));
}

async function syncSolves(): Promise<void> {
  if (syncing || deleting || !user) return;
  const activeUser = user;
  syncing = true;
  renderSolves();
  try {
    if (pendingSolves(activeUser.id).length) {
      storageStatus.hidden = false;
      storageStatus.textContent = 'saving';
    }
    // Repeat if another solve was queued while a request was in flight.
    let page;
    do {
      await savePendingSolves(activeUser.id);
      if (user !== activeUser) return;
      page = await loadSolves();
      if (user !== activeUser) return;
    } while (pendingSolves(activeUser.id).length);
    organization = await request<Organization>('/api/organization');
    if (user !== activeUser) return;
    element('cube-options').replaceChildren(...organization.cubes.map(cube => {
      const option = document.createElement('option');
      option.value = cube.name;
      return option;
    }));
    solves.splice(0, solves.length, ...page.items);
    solveCount = page.total;
    renderSolves();
    storageStatus.hidden = true;
  } catch (error) {
    if (user !== activeUser) return;
    storageStatus.hidden = false;
    storageStatus.textContent = 'connection unavailable';
    if (error instanceof ApiError && (error.status === 401 || error.status === 409)) accounts.requireLogin();
  } finally {
    syncing = false;
    if (user === activeUser) renderSolves();
  }
}

bindControls(timer, area, (solve) => {
  value.animate([{ color: 'var(--ready)' }, { color: 'var(--ready)' }], { duration: 300 });
  solves.unshift(solve);
  solveCount += 1;
  renderSolves();
  element('announcement').textContent = `solve ${formatTime(solve.duration_ms)}`;
  try {
    if (!user) throw new Error('sign in required');
    queueSolve(solve, user.id, { category_id: eventSelect.value ? Number(eventSelect.value) : null, cube_name: cubeName.value.trim().toLowerCase() || null });
    void syncSolves();
  } catch {
    storageStatus.hidden = false;
    storageStatus.textContent = 'save unavailable';
  }
});
const accounts = setupAccounts(async nextUser => {
  user = null;
  timer.reset();
  value.getAnimations().forEach(animation => animation.cancel());
  value.textContent = formatTime(0);
  solves.splice(0);
  solveCount = 0;
  organization = { categories: [], cubes: [] };
  renderSolves();
  eventSelect.replaceChildren();
  cubeName.value = '';
  hidden.checked = false;
  settings.open = false;
  element('account-name').textContent = nextUser?.username ?? '';
  if (!nextUser) return;
  const loaded = await request<Organization>('/api/organization');
  organization = loaded;
  eventSelect.replaceChildren(...loaded.categories.map(event => {
    const option = document.createElement('option');
    option.value = String(event.id);
    option.textContent = event.name;
    return option;
  }));
  user = nextUser;
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey()) ?? '{}');
    if (loaded.categories.some(event => String(event.id) === saved.event)) eventSelect.value = saved.event;
    cubeName.value = typeof saved.cube === 'string' ? saved.cube : '';
    hidden.checked = saved.hidden === true;
    solves.push(...pendingSolves(user.id).sort((a, b) => b.started_at.localeCompare(a.started_at)).map(solve => ({ ...solve, pending: true })));
    solveCount = solves.length;
    renderSolves();
  } catch {
    storageStatus.hidden = false;
    storageStatus.textContent = 'storage unavailable';
  }
  void syncSolves();
});

function savePreferences(): void {
  if (!user) return;
  try {
    cubeName.value = cubeName.value.toLowerCase();
    localStorage.setItem(preferencesKey(), JSON.stringify({ event: eventSelect.value, cube: cubeName.value, hidden: hidden.checked }));
  } catch {
    storageStatus.hidden = false;
    storageStatus.textContent = 'settings unavailable';
  }
}
for (const input of [eventSelect, cubeName, hidden]) input.addEventListener('change', savePreferences);
cubeName.addEventListener('input', savePreferences);
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
  const elapsed = timer.elapsed();
  const hiddenTime = running && hidden.checked;
  const dots = '.'.repeat(Math.floor(elapsed / 300) % 5 + 1);
  value.textContent = hiddenTime ? dots : formatTime(elapsed);
  value.classList.toggle('hidden-value', hiddenTime);
  area.dataset.state = timer.state;
  const busy = running || timer.state === 'HOLDING' || timer.state === 'READY';
  area.disabled = !user;
  hidden.disabled = analysisTab.disabled = eventSelect.disabled = cubeName.disabled = busy || !user;
  element<HTMLButtonElement>('logout').disabled = busy || syncing || deleting;
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
