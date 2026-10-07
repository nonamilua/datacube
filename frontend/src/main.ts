import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/main.css';
import { SolveTimer, formatTime, type Solve } from './timer/timer';
import { bindControls } from './timer/controls';
import { ApiError, deleteSolve, updateSolve, loadSolves, pendingSolves, queueSolve, renameQueuedCubes, request, savePendingSolves, type Organization, type StoredSolve, type User } from './api/api';
import { setupAccounts } from './accounts';
import { icon } from './icons';
import { setupDashboard } from './analytics/dashboard';
import { bindShortText, validateShortText } from './text-fields';
import { editorAnchor } from './solve-editor';
import { Scrambles, type ScrambleSnapshot } from './scrambles';

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
const scramblesEnabled = element<HTMLInputElement>('scrambles-enabled');
const scrambleText = element('scramble-text');
const replaceScramble = element<HTMLButtonElement>('replace-scramble');
replaceScramble.append(icon('shuffle'));
const scrambles = new Scrambles(() => {
  element('current-scramble').hidden = !scrambles.enabled;
  scrambleText.textContent = scrambles.status === 'ready' ? scrambles.text : scrambles.status === 'failed' ? 'scramble failed try again' : 'loading scramble';
});
let startedScramble: ScrambleSnapshot | null = null;
let startedLabels: {category_id: number | null; cube_name: string | null} = {category_id:null, cube_name:null};
const scramblePopup = element('scramble-popup');
let scrambleButton: HTMLButtonElement | null = null;

function closeScramblePopup(): void {
  scramblePopup.hidden = true;
  scrambleButton?.setAttribute('aria-expanded', 'false');
  scrambleButton = null;
}

function positionScramblePopup(): void {
  if (scramblePopup.hidden || !scrambleButton?.isConnected) return;
  const rect = scrambleButton.getBoundingClientRect();
  scramblePopup.style.left = `${Math.max(16, Math.min(rect.left, innerWidth - scramblePopup.offsetWidth - 16))}px`;
  scramblePopup.style.top = `${Math.max(16, Math.min(rect.bottom + 8, innerHeight - scramblePopup.offsetHeight - 16))}px`;
}

async function openScramblePopup(solve: DisplaySolve, button: HTMLButtonElement): Promise<void> {
  const same = scrambleButton === button && !scramblePopup.hidden;
  if (!await saveEditor()) return;
  closeScramblePopup();
  if (same || !solve.scramble) return;
  scrambleButton = editorAnchor(button, Array.from(document.querySelectorAll<HTMLButtonElement>('[aria-controls="scramble-popup"]')), solve.id!);
  scrambleButton.setAttribute('aria-expanded', 'true');
  element('saved-scramble').textContent = solve.scramble;
  scramblePopup.hidden = false;
  positionScramblePopup();
}
const dashboard = setupDashboard();
type DisplaySolve = Solve & Partial<StoredSolve> & { pending?: boolean };
const solves: DisplaySolve[] = [];
let solveCount = 0;
let syncing = false;
let deleting = false;
let editing = false;
let editorSave: Promise<boolean> | null = null;
let solveRevision = 0;
let renderedSolves = '';
let lastSolve: DisplaySolve | null = null;
let editorSolve: DisplaySolve | null = null;
let editorButton: HTMLButtonElement | null = null;
const editor = element('solve-editor');
const plusTwo = element<HTMLInputElement>('penalty-plus-two');
const dnf = element<HTMLInputElement>('penalty-dnf');
const custom = element<HTMLInputElement>('solve-custom');
const customValidation = element('custom-validation');
bindShortText(custom, customValidation);

function solveResult(solve: DisplaySolve): string {
  return solve.penalty === 'DNF' ? 'dnf' : formatTime(solve.duration_ms + (solve.penalty === '+2' ? 2000 : 0));
}

function closeEditor(): void {
  editor.hidden = true;
  editorButton?.setAttribute('aria-expanded', 'false');
  document.querySelectorAll('.solve-action[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  editorSolve = null;
  editorButton = null;
}

async function openEditor(solve: DisplaySolve, button: HTMLButtonElement): Promise<void> {
  closeScramblePopup();
  const same = editorSolve?.id === solve.id;
  if (editorSolve && !await saveEditor()) return;
  if (same) return;
  editorSolve = solve;
  const currentButton = editorAnchor(button, Array.from(document.querySelectorAll<HTMLButtonElement>('.solve-action[aria-controls="solve-editor"]')), solve.id!);
  editorButton = currentButton;
  currentButton.setAttribute('aria-expanded', 'true');
  plusTwo.checked = solve.penalty === '+2';
  dnf.checked = solve.penalty === 'DNF';
  custom.value = solve.custom ?? '';
  customValidation.hidden = true;
  element('solve-editor-status').hidden = true;
  editor.hidden = false;
  positionEditor();
}

function positionEditor(): void {
  if (editor.hidden || !editorButton?.isConnected) return;
  const rect = editorButton.getBoundingClientRect();
  editor.style.left = `${Math.max(16, Math.min(rect.left, innerWidth - editor.offsetWidth - 16))}px`;
  editor.style.top = `${Math.max(16, Math.min(rect.bottom + 8, innerHeight - editor.offsetHeight - 16))}px`;
}

function solveActions(solve: DisplaySolve, historyRow = false): HTMLDivElement {
  const actions = document.createElement('div');
  actions.className = 'solve-actions';
  const actionNames: ('scramble' | 'edit' | 'trash')[] = historyRow && solve.scramble ? ['scramble', 'edit', 'trash'] : ['edit', 'trash'];
  for (const action of actionNames) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'solve-action icon-button';
    button.dataset.solveId = solve.id;
    button.title = action === 'scramble' ? 'view scramble' : action === 'edit' ? 'edit solve' : 'delete solve';
    button.setAttribute('aria-label', `${button.title} ${solveResult(solve)}`);
    button.disabled = action === 'scramble' ? deleting || editing : !solve.id || Boolean(solve.pending) || deleting || editing;
    button.append(icon(action));
    if (action === 'edit') {
      button.setAttribute('aria-expanded', String(editorSolve?.id === solve.id));
      button.setAttribute('aria-controls', 'solve-editor');
    }
    if (action === 'scramble') {
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'scramble-popup');
    }
    button.addEventListener('click', () => action === 'scramble' ? void openScramblePopup(solve, button) : action === 'edit' ? void openEditor(solve, button) : void removeSolve(solve));
    actions.append(button);
  }
  return actions;
}

function saveEditor(): Promise<boolean> {
  // Outside clicks and navigation can request the same save during one event.
  editorSave ??= persistEditor().finally(() => { editorSave = null; });
  return editorSave;
}

async function persistEditor(): Promise<boolean> {
  const solve = editorSolve;
  if (!solve) return true;
  if (!solve.id || !user || editing || deleting) return false;
  const penalty = dnf.checked ? 'DNF' : plusTwo.checked ? '+2' : 'OK';
  const customValue = custom.value.trim().toLowerCase() || null;
  if (penalty === (solve.penalty ?? 'OK') && customValue === (solve.custom ?? null)) { closeEditor(); return true; }
  const activeUser = user;
  editing = true;
  solveRevision += 1;
  plusTwo.checked = penalty === '+2';
  dnf.checked = penalty === 'DNF';
  plusTwo.disabled = dnf.disabled = custom.disabled = true;
  renderSolves();
  try {
    const updated = await updateSolve(solve.id, activeUser.id, penalty, customValue);
    if (user !== activeUser) return false;
    Object.assign(solve, updated);
    const row = solves.find(item => item.id === solve.id);
    if (row) Object.assign(row, updated);
    if (lastSolve?.id === solve.id) Object.assign(lastSolve, updated);
    element('solve-editor-status').hidden = true;
    element('announcement').textContent = 'solve updated';
    closeEditor();
    return true;
  } catch (error) {
    if (user !== activeUser) return false;
    const status = element('solve-editor-status');
    status.hidden = false;
    status.textContent = error instanceof ApiError ? error.message : 'could not connect try again';
    if (error instanceof ApiError && (error.status === 401 || error.status === 409)) accounts.requireLogin();
    return false;
  } finally {
    editing = false;
    plusTwo.disabled = dnf.disabled = custom.disabled = false;
    if (user === activeUser) {
      renderSolves();
    }
  }
}
plusTwo.addEventListener('change', () => { if (plusTwo.checked) dnf.checked = false; });
dnf.addEventListener('change', () => { if (dnf.checked) plusTwo.checked = false; });
custom.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void saveEditor(); } });
const storageStatus = element('storage-status');
const eventSelect = element<HTMLSelectElement>('event-select');
const cubeName = element<HTMLInputElement>('cube-name');
const cubeValidation = element('cube-validation');
bindShortText(cubeName, cubeValidation);
let user: User | null = null;
let organization: Organization = { categories: [], cubes: [] };
const preferencesKey = () => `namicubes settings ${user!.id}`;
function configureScrambles(): void {
  const event = organization.categories.find(item => String(item.id) === eventSelect.value)?.name ?? '';
  scrambles.configure(user?.id ?? null, event, scramblesEnabled.checked);
}
scramblesEnabled.addEventListener('change', configureScrambles);
replaceScramble.addEventListener('click', () => {
  if (timer.state === 'HOLDING' || timer.state === 'READY' || timer.state === 'RUNNING') return;
  void scrambles.replace();
});
element('timer-tab').append(icon('timer'));
element('analysis-tab').append(icon('analysis'));
element('settings-panel').querySelector('summary')!.append(icon('settings'));
element('history-panel').querySelector('summary')!.append(icon('history'));

function solveRow(solve: DisplaySolve): HTMLLIElement {
  const row = document.createElement('li');
  const result = document.createElement('strong');
  result.textContent = solveResult(solve) + (solve.penalty === '+2' ? ' +2' : '');
  const remove = solveActions(solve, true);
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
  if (!solve.id || solve.pending || !user || deleting || editing) return;
  closeEditor();
  closeScramblePopup();
  const activeUser = user;
  deleting = true;
  solveRevision += 1;
  renderSolves();
  let removed = false;
  try {
    await deleteSolve(solve.id, activeUser.id);
    if (user !== activeUser) return;
    const index = solves.findIndex(item => item.id === solve.id);
    if (index !== -1) solves.splice(index, 1);
    if (lastSolve?.id === solve.id) { lastSolve = null; timer.reset(); }
    solveCount = Math.max(0, solveCount - 1);
    storageStatus.hidden = true;
    element('solve-action-status').hidden = true;
    element('announcement').textContent = 'solve deleted';
    removed = true;
  } catch (error) {
    if (user !== activeUser) return;
    storageStatus.hidden = false;
    storageStatus.textContent = 'delete unavailable';
    element('solve-action-status').hidden = false;
    element('solve-action-status').textContent = 'delete unavailable';
    if (error instanceof ApiError && (error.status === 401 || error.status === 409)) accounts.requireLogin();
  } finally {
    deleting = false;
    if (user === activeUser) renderSolves();
  }
  if (removed) void syncSolves();
}

function renderSolves(): void {
  dashboard.update(solves.filter((solve): solve is StoredSolve => Boolean(solve.id) && !solve.pending), organization);
  const snapshot = JSON.stringify([lastSolve, solves, solveCount, organization, deleting, editing]);
  if (snapshot === renderedSolves) return;
  renderedSolves = snapshot;
  const actions = element('last-solve-actions');
  actions.replaceChildren(...(lastSolve ? [solveActions(lastSolve)] : []));
  element('empty-message').hidden = solveCount > 0;
  element('recent-solves').replaceChildren(...solves.map(solveRow));
}

async function syncSolves(): Promise<void> {
  if (syncing || deleting || editing || editorSolve || !scramblePopup.hidden || !user) return;
  const activeUser = user;
  const revision = solveRevision;
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
    const loadedOrganization = await request<Organization>('/api/organization');
    if (user !== activeUser) return;
    // A mutation started during this read; do not restore its stale result.
    if (revision !== solveRevision) return;
    organization = loadedOrganization;
    element('cube-options').replaceChildren(...organization.cubes.map(cube => {
      const option = document.createElement('option');
      option.value = cube.name;
      return option;
    }));
    solves.splice(0, solves.length, ...page.items);
    if (lastSolve?.id && !pendingSolves(activeUser.id).some(item => item.id === lastSolve!.id)) {
      lastSolve = page.items.find(item => item.id === lastSolve!.id) ?? { ...lastSolve, pending: false };
    }
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
  closeEditor();
  lastSolve = { ...solve, pending: true };
  element('solve-action-status').hidden = true;
  value.animate([{ color: 'var(--ready)' }, { color: 'var(--ready)' }], { duration: 300 });
  solves.unshift(solve);
  solveCount += 1;
  renderSolves();
  element('announcement').textContent = `solve ${formatTime(solve.duration_ms)}`;
  try {
    if (!user) throw new Error('sign in required');
    lastSolve = { ...queueSolve(solve, user.id, { ...startedLabels, scramble: startedScramble?.text ?? null }), pending: true };
    solves[0] = lastSolve;
    renderSolves();
    void syncSolves();
  } catch {
    storageStatus.hidden = false;
    storageStatus.textContent = 'save unavailable';
  }
  void scrambles.replace();
}, {
  canPrepare: () => scrambles.canStart,
  onStart: () => {
    startedScramble = scrambles.capture();
    startedLabels = Object.freeze({category_id:eventSelect.value ? Number(eventSelect.value) : null, cube_name:cubeName.value.trim().toLowerCase() || null});
  },
});
const accounts = setupAccounts(async nextUser => {
  user = null;
  scrambles.configure(null, '', false);
  startedScramble = null;
  closeScramblePopup();
  dashboard.reset();
  history.open = false;
  closeEditor();
  lastSolve = null;
  element('solve-action-status').hidden = true;
  timer.reset();
  value.getAnimations().forEach(animation => animation.cancel());
  value.textContent = formatTime(0);
  solves.splice(0);
  solveCount = 0;
  organization = { categories: [], cubes: [] };
  renderSolves();
  eventSelect.replaceChildren();
  cubeName.value = '';
  cubeValidation.hidden = true;
  hidden.checked = false;
  scramblesEnabled.checked = false;
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
    const aliases: Record<string, string> = {'dayan guhong pro+': 'guhongpro+', 'moyu rs3m 2020': 'rs3m 2020', 'moyu rs3m v5': 'rs3m v5'};
    const renamedCubes = Object.fromEntries(Object.entries(aliases).filter(([old, renamed]) => loaded.cubes.some(cube => cube.name === renamed) && !loaded.cubes.some(cube => cube.name === old)));
    renameQueuedCubes(user.id, renamedCubes);
    const renamed = aliases[cubeName.value];
    if (renamed && loaded.cubes.some(cube => cube.name === renamed) && !loaded.cubes.some(cube => cube.name === cubeName.value)) cubeName.value = renamed;
    validateShortText(cubeName, cubeValidation);
    hidden.checked = saved.hidden === true;
    scramblesEnabled.checked = saved.scrambles === true;
    savePreferences();
    solves.push(...pendingSolves(user.id).sort((a, b) => b.started_at.localeCompare(a.started_at)).map(solve => ({ ...solve, pending: true })));
    solveCount = solves.length;
    renderSolves();
  } catch {
    storageStatus.hidden = false;
    storageStatus.textContent = 'storage unavailable';
  }
  configureScrambles();
  void syncSolves();
});

function savePreferences(): void {
  if (!user) return;
  try {
    cubeName.value = cubeName.value.toLowerCase();
    localStorage.setItem(preferencesKey(), JSON.stringify({ event: eventSelect.value, cube: cubeName.value, hidden: hidden.checked, scrambles:scramblesEnabled.checked }));
  } catch {
    storageStatus.hidden = false;
    storageStatus.textContent = 'settings unavailable';
  }
}
eventSelect.addEventListener('change', () => { cubeName.value = ''; validateShortText(cubeName, cubeValidation); configureScrambles(); });
window.addEventListener('online', () => void syncSolves());
window.setInterval(() => void syncSolves(), 15000);
const timerTab = element<HTMLButtonElement>('timer-tab');
const analysisTab = element<HTMLButtonElement>('analysis-tab');
const settings = element<HTMLDetailsElement>('settings-panel');
const history = element<HTMLDetailsElement>('history-panel');
function closeSettings(): boolean {
  if (!settings.open) return true;
  savePreferences();
  settings.open = false;
  return true;
}
settings.addEventListener('toggle', () => {
  if (settings.open) {
    closeScramblePopup();
    if (editorSolve) { settings.open = false; void saveEditor().then(saved => { if (saved) settings.open = true; }); }
    else history.open = false;
  } else savePreferences();
});
history.addEventListener('toggle', () => {
  if (!history.open) closeScramblePopup();
  if (history.open) {
    if (!closeSettings()) { history.open = false; return; }
    if (editorSolve) {
      history.open = false;
      void saveEditor().then(saved => { if (saved) history.open = true; });
    }
  }
});
const header = document.querySelector<HTMLElement>('.app-header')!;
const updateTimerTarget = () => {
  document.documentElement.style.setProperty('--timer-top', `${header.getBoundingClientRect().bottom}px`);
};
new ResizeObserver(updateTimerTarget).observe(header);
window.addEventListener('resize', updateTimerTarget);
updateTimerTarget();
document.addEventListener('click', (event) => {
  if (event.target instanceof Node && !settings.contains(event.target)) closeSettings();
  if (!event.composedPath().includes(history) && !event.composedPath().includes(editor) && !event.composedPath().includes(scramblePopup)) history.open = false;
  if (event.target instanceof Node && !scramblePopup.contains(event.target) && !scrambleButton?.contains(event.target)) closeScramblePopup();
  if (event.target instanceof Node && !editor.contains(event.target) && !editorButton?.contains(event.target) && !(event.target instanceof Element && event.target.closest('[aria-controls="scramble-popup"]'))) void saveEditor();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!scramblePopup.hidden) { closeScramblePopup(); return; }
    if (editorSolve) void saveEditor();
    else { history.open = false; closeSettings(); }
  }
});
window.addEventListener('resize', positionEditor);
window.addEventListener('resize', positionScramblePopup);
async function showPanel(analysis: boolean): Promise<void> {
  if (!closeSettings() || !await saveEditor()) return;
  history.open = false;
  closeScramblePopup();
  timer.cancelPreparation();
  element('timer-panel').hidden = analysis;
  element('analysis-panel').hidden = !analysis;
  const active = analysis ? analysisTab : timerTab;
  const inactive = analysis ? timerTab : analysisTab;
  active.setAttribute('aria-current', 'page');
  inactive.removeAttribute('aria-current');
  if (analysis) dashboard.show();
  else {
    // Panel closing can finish before the next frame enables the timer.
    area.disabled = !user || editing || deleting || !scrambles.canStart;
    if (!area.disabled) area.focus({ preventScroll: true });
  }
}
timerTab.addEventListener('click', event => {
  if (event.detail > 0) area.removeAttribute('data-keyboard-focus');
  void showPanel(false);
});
analysisTab.addEventListener('click', () => void showPanel(true));

let lastState = '';
function render(): void {
  timer.update();
  const running = timer.state === 'RUNNING';
  const elapsed = timer.elapsed();
  const hiddenTime = running && hidden.checked;
  const dots = '.'.repeat(Math.floor(elapsed / 300) % 5 + 1);
  const displayedTime = hiddenTime ? dots : timer.state === 'STOPPED' && lastSolve ? solveResult(lastSolve) : formatTime(elapsed);
  if (value.textContent !== displayedTime) value.textContent = displayedTime;
  value.classList.toggle('hidden-value', hiddenTime);
  area.dataset.state = timer.state;
  const busy = running || timer.state === 'HOLDING' || timer.state === 'READY';
  area.disabled = !user || editing || deleting || Boolean(editorSolve) || !scramblePopup.hidden || history.open || settings.open || !scrambles.canStart;
  history.inert = busy || !user;
  const actions = element('last-solve-actions');
  const hideActions = busy || timer.state !== 'STOPPED' || !lastSolve;
  if (actions.hidden !== hideActions) actions.hidden = hideActions;
  if (busy && editorSolve) closeEditor();
  hidden.disabled = scramblesEnabled.disabled = analysisTab.disabled = eventSelect.disabled = cubeName.disabled = busy || !user;
  replaceScramble.disabled = busy || scrambles.status === 'loading' || !user;
  element<HTMLButtonElement>('logout').disabled = busy || syncing || deleting || editing;
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
