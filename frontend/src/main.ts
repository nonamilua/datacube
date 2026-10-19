import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/main.css';
import { SolveTimer, formatTime, type Solve } from './timer/timer';
import { bindControls } from './timer/controls';
import { ApiError, deleteSolve, updateSolve, loadSolves, pendingSolves, queueSolve, renameQueuedCubes, request, savePendingSolves, type Organization, type StoredSolve, type User } from './api/api';
import { setupAccounts } from './accounts';
import { displayUsername } from './account-validation';
import { icon } from './icons';
import { setupDashboard } from './analytics/dashboard';
import { bindShortText, validateShortText } from './text-fields';
import { editorAnchor } from './solve-editor';
import { CubeSelector } from './cube-selector';
import { Scrambles, type ScrambleSnapshot } from './scrambles';
import { FixedTags } from './fixed-tags';
import { setupEventIcon } from './event-icon';
import { setupAccountTools } from './import/interface';
import { setupHistory } from './history/interface';
import { t, setText, setActionLabel, initializeTranslations, setLanguage, currentLanguage, onLanguageChange, settingsKey, languageForAccount, rememberLanguage } from './i18n';

initializeTranslations();

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
}
const timer = new SolveTimer();
const accountTools = setupAccountTools(()=>timer.state === 'IDLE' || timer.state === 'STOPPED');
const area = element<HTMLButtonElement>('timer-area');
const value = element('timer-value');
const hint = element('timer-hint');
const hidden = element<HTMLInputElement>('hidden-time');
const scramblesEnabled = element<HTMLInputElement>('scrambles-enabled');
const fixedTagsEnabled = element<HTMLInputElement>('fixed-tags');
const hideOutliers = element<HTMLInputElement>('hide-outliers');
const fixedTags = new FixedTags();
const languageSelect = element<HTMLSelectElement>('language-select');
const scrambleText = element('scramble-text');
const replaceScramble = element<HTMLButtonElement>('replace-scramble');
replaceScramble.append(icon('shuffle'));
function renderScramble(): void {
  element('current-scramble').hidden = !scrambles.enabled;
  scrambleText.textContent = scrambles.status === 'ready' ? scrambles.text : t(scrambles.status === 'failed' ? 'scramble failed try again' : 'loading scramble');
}
const scrambles = new Scrambles(renderScramble);
onLanguageChange(renderScramble);
let startedScramble: ScrambleSnapshot | null = null;
let startedLabels: {category_id: number | null; cube_name: string | null; cube_model_id?: string | null; custom?: string | null} = {category_id:null, cube_name:null};
const scramblePopup = element('scramble-popup');
let scrambleButton: HTMLButtonElement | null = null;

function closeScramblePopup(): void {
  scramblePopup.hidden = true;
  scrambleButton?.setAttribute('aria-expanded', 'false');
  scrambleButton = null;
}

function positionScramblePopup(): void {
  if (scramblePopup.hidden || !scrambleButton?.isConnected) return;
  positionSolvePopup(scramblePopup, scrambleButton);
}

function positionSolvePopup(popup: HTMLElement, button: HTMLButtonElement): void {
  const panel = button.closest<HTMLElement>('.history-content');
  const row = button.closest('li');
  const list = panel?.querySelector<HTMLElement>('.solve-list');
  if (panel && row && list) {
    const bounds = panel.getBoundingClientRect();
    const listBounds = list.getBoundingClientRect();
    const top = Math.max(0, panel.querySelector('.history-header')?.getBoundingClientRect().bottom ?? bounds.top + panel.clientTop);
    const bottom = Math.min(innerHeight, bounds.top + panel.clientTop + panel.clientHeight);
    popup.style.maxWidth = `${listBounds.width}px`;
    popup.style.maxHeight = `${Math.max(0, bottom - top)}px`;
    popup.style.overflowY = 'auto';
    popup.style.left = `${listBounds.right - popup.offsetWidth}px`;
    popup.style.top = `${Math.max(top, Math.min(row.getBoundingClientRect().bottom, bottom - popup.offsetHeight))}px`;
    // These body-level fixed popups stay in place while the history list scrolls.
    return;
  }
  popup.style.removeProperty('max-width');
  popup.style.removeProperty('max-height');
  popup.style.removeProperty('overflow-y');
  const rect = button.getBoundingClientRect();
  popup.style.left = `${Math.max(16, Math.min(rect.left, innerWidth - popup.offsetWidth - 16))}px`;
  popup.style.top = `${Math.max(16, Math.min(rect.bottom + 8, innerHeight - popup.offsetHeight - 16))}px`;
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
let syncingAccount: User | null = null;
let savingSolves = false;
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
  positionSolvePopup(editor, editorButton);
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
    setActionLabel(button, action === 'scramble' ? 'view scramble' : action === 'edit' ? 'edit solve' : 'delete solve', ` ${solveResult(solve)}`);
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
  const tagVersion = fixedTags.version;
  const customChanged = customValue !== (solve.custom ?? null);
  editing = true;
  solveRevision += 1;
  plusTwo.checked = penalty === '+2';
  dnf.checked = penalty === 'DNF';
  plusTwo.disabled = dnf.disabled = custom.disabled = true;
  renderSolves();
  try {
    const updated = await updateSolve(solve.id, activeUser.id, penalty, customValue);
    if (user !== activeUser) return false;
    if (customChanged) fixedTags.remember(updated.category_id, updated.custom, tagVersion);
    Object.assign(solve, updated, {pending:false});
    const row = solves.find(item => item.id === solve.id);
    if (row) Object.assign(row, updated);
    if (lastSolve?.id === solve.id) Object.assign(lastSolve, updated);
    updateAnalytics();
    historyView.store.upsert({...updated,pending:false});
    void historyView.store.refreshLatest();
    element('solve-editor-status').hidden = true;
    setText(element('announcement'), 'solve updated');
    closeEditor();
    return true;
  } catch (error) {
    if (user !== activeUser) return false;
    const status = element('solve-editor-status');
    status.hidden = false;
    setText(status, error instanceof ApiError ? error.message : 'could not connect try again');
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
const cubeSelector = new CubeSelector(cubeName, element<HTMLOutputElement>('cube-model'), element('cube-suggestions'), element('cube-model-warning'));
const selectedEvent = () => organization.categories.find(item => String(item.id) === eventSelect.value)?.name ?? '';
let user: User | null = null;
let accountInitialization = 0;
let organization: Organization = { categories: [], cubes: [] };
const eventIcon = setupEventIcon(eventSelect,element('selected-event-icon'),selectedEvent);
const preferencesKey = () => settingsKey(user!.id);
function configureFixedTags(): void {
  fixedTags.configure(user?.id ?? null, eventSelect.value ? Number(eventSelect.value) : null, fixedTagsEnabled.checked);
}
fixedTagsEnabled.addEventListener('change', configureFixedTags);
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

const historyRecords = new WeakMap<HTMLLIElement,DisplaySolve>();
function solveRow(solve: DisplaySolve): HTMLLIElement {
  const row = document.createElement('li');
  solve = {...solve};
  historyRecords.set(row,solve);
  row.dataset.solveId = solve.id;
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

function updateHistoryRow(row: HTMLLIElement, updated: StoredSolve): void {
  const solve = historyRecords.get(row)!;
  Object.assign(solve,updated,{pending:Boolean((updated as DisplaySolve).pending)});
  const event = organization.categories.find(item => item.id === solve.category_id)?.name;
  const cube = (solve as StoredSolve & {cube_name?: string}).cube_name ?? organization.cubes.find(item => item.id === solve.cube_id)?.name;
  const snapshot = JSON.stringify([solve,event,cube,deleting,editing,currentLanguage()]);
  if (row.dataset.rendered === snapshot) return;
  row.dataset.rendered = snapshot;
  row.querySelector('strong')!.textContent = solveResult(solve) + (solve.penalty === '+2' ? ' +2' : '');
  let labels = row.querySelector<HTMLElement>('.solve-labels');
  if (!labels && (event || cube)) { labels = document.createElement('span'); labels.className = 'solve-labels'; row.insertBefore(labels,row.querySelector('.solve-actions')); }
  if (labels) labels.textContent = [event,cube].filter(Boolean).join(' ');
  for (const button of Array.from(row.querySelectorAll<HTMLButtonElement>('.solve-action'))) {
    const scramble = button.getAttribute('aria-controls') === 'scramble-popup';
    button.disabled = deleting || editing || (!scramble && Boolean(solve.pending));
    setActionLabel(button,scramble ? 'view scramble' : button.getAttribute('aria-controls') === 'solve-editor' ? 'edit solve' : 'delete solve',` ${solveResult(solve)}`);
  }
}
const historyView = setupHistory(solveRow,updateHistoryRow,async () => {
  if (!await saveEditor()) return false;
  closeScramblePopup(); return true;
});

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
    updateAnalytics();
    if (lastSolve?.id === solve.id) { lastSolve = null; timer.reset(); }
    historyView.store.remove(solve.id);
    void historyView.store.refreshLatest();
    solveCount = Math.max(0, solveCount - 1);
    storageStatus.hidden = true;
    element('solve-action-status').hidden = true;
    setText(element('announcement'), 'solve deleted');
    removed = true;
  } catch (error) {
    if (user !== activeUser) return;
    storageStatus.hidden = false;
    setText(storageStatus, 'delete unavailable');
    element('solve-action-status').hidden = false;
    setText(element('solve-action-status'), 'delete unavailable');
    if (error instanceof ApiError && (error.status === 401 || error.status === 409)) accounts.requireLogin();
  } finally {
    deleting = false;
    if (user === activeUser) renderSolves();
  }
  if (removed) void syncSolves();
}

function updateAnalytics(): void {
  dashboard.update(solves.filter((solve): solve is StoredSolve => Boolean(solve.id) && !solve.pending), organization);
}

function renderSolves(): void {
  historyView.render();
  const snapshot = JSON.stringify([lastSolve, deleting, editing]);
  if (snapshot === renderedSolves) return;
  renderedSolves = snapshot;
  const actions = element('last-solve-actions');
  actions.replaceChildren(...(lastSolve ? [solveActions(lastSolve)] : []));
}

async function syncSolves(): Promise<void> {
  if (!user || syncingAccount === user || deleting || editing || editorSolve || !scramblePopup.hidden) return;
  const activeUser = user;
  const revision = solveRevision;
  syncingAccount = activeUser;
  renderSolves();
  try {
    if (pendingSolves(activeUser.id).length) {
      storageStatus.hidden = false;
      setText(storageStatus, 'saving');
    }
    // Repeat if another solve was queued while a request was in flight.
    let page;
    do {
      // Polling is read-only; only pending solve writes need to lock sign out.
      savingSolves = pendingSolves(activeUser.id).length > 0;
      await savePendingSolves(activeUser.id);
      if (user !== activeUser) return;
      savingSolves = false;
      page = await loadSolves();
      if (user !== activeUser) return;
    } while (pendingSolves(activeUser.id).length);
    const loadedOrganization = await request<Organization>('/api/organization');
    if (user !== activeUser) return;
    // A mutation started during this read; do not restore its stale result.
    if (revision !== solveRevision) return;
    const organizationChanged = JSON.stringify(organization) !== JSON.stringify(loadedOrganization);
    organization = loadedOrganization;
    const historyChanged = JSON.stringify(page.items) !== JSON.stringify(solves.filter(solve => !solve.pending));
    if (historyChanged) {
      const records = new Map(page.items.map(solve => [solve.id,solve]));
      for (const known of new Map([...historyView.store.cache,...historyView.store.rows].map(solve => [solve.id,solve])).values()) {
        const updated = records.get(known.id);
        if (!updated) historyView.store.remove(known.id);
        else if (JSON.stringify(updated) !== JSON.stringify(known)) historyView.store.upsert({...updated,pending:false});
      }
      if (JSON.stringify(page.items.slice(0,50)) !== JSON.stringify(historyView.store.cache)) void historyView.store.refreshLatest();
    }
    solves.splice(0, solves.length, ...page.items);
    if (historyChanged || organizationChanged) updateAnalytics();
    if (lastSolve?.id && !pendingSolves(activeUser.id).some(item => item.id === lastSolve!.id)) {
      lastSolve = page.items.find(item => item.id === lastSolve!.id) ?? { ...lastSolve, pending: false };
    }
    solveCount = page.total;
    renderSolves();
    storageStatus.hidden = true;
  } catch (error) {
    if (user !== activeUser) return;
    storageStatus.hidden = false;
    setText(storageStatus, 'connection unavailable');
    if (error instanceof ApiError && (error.status === 401 || error.status === 409)) accounts.requireLogin();
  } finally {
    if (syncingAccount === activeUser) { syncingAccount = null; savingSolves = false; }
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
  element('announcement').textContent = `${t('solve')} ${formatTime(solve.duration_ms)}`;
  try {
    if (!user) throw new Error('sign in required');
    lastSolve = { ...queueSolve(solve, user.id, { ...startedLabels, scramble: startedScramble?.text ?? null }), pending: true };
    solves[0] = lastSolve;
    historyView.store.upsert(lastSolve as StoredSolve & {pending:true});
    renderSolves();
    void syncSolves();
  } catch {
    storageStatus.hidden = false;
    setText(storageStatus, 'save unavailable');
  }
  void scrambles.replace();
}, {
  canPrepare: () => scrambles.canStart,
  onStart: () => {
    startedScramble = scrambles.capture();
    startedLabels = Object.freeze({category_id:eventSelect.value ? Number(eventSelect.value) : null, cube_name:cubeName.value.trim().toLowerCase() || null, cube_model_id:cubeSelector.modelId, custom:fixedTags.value});
  },
});
const accounts = setupAccounts(async nextUser => {
  const initialization = ++accountInitialization;
  accountTools.reset();
  user = null;
  savingSolves = false;
  historyView.store.setAccount(null);
  fixedTags.configure(null, null, false);
  scrambles.configure(null, '', false);
  startedScramble = null;
  closeScramblePopup();
  dashboard.reset();
  closeHistory();
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
  eventIcon.update();
  cubeName.value = '';
  void cubeSelector.configure('');
  cubeValidation.hidden = true;
  hidden.checked = false;
  scramblesEnabled.checked = false;
  fixedTagsEnabled.checked = false;
  hideOutliers.checked = true;
  setLanguage('en'); languageSelect.value = 'en';
  settings.open = false;
  const accountName = nextUser?.username ?? '';
  element('account-name-text').textContent = displayUsername(accountName);
  element('account-name-full').textContent = accountName;
  element('account-name').title = accountName;
  if (!nextUser) return;
  const loaded = await request<Organization>('/api/organization');
  if (initialization !== accountInitialization) return;
  organization = loaded;
  eventSelect.replaceChildren(...loaded.categories.map(event => {
    const option = document.createElement('option');
    option.value = String(event.id);
    option.textContent = event.name;
    return option;
  }));
  user = nextUser;
  updateAnalytics();
  historyView.store.setAccount(nextUser.id);
  const historyReady = historyView.store.refreshLatest();
  try {
    setLanguage(languageForAccount(localStorage,user.id));
    languageSelect.value = currentLanguage();
    const saved = JSON.parse(localStorage.getItem(preferencesKey()) ?? '{}');
    if (loaded.categories.some(event => String(event.id) === saved.event)) eventSelect.value = saved.event;
    cubeName.value = typeof saved.cube === 'string' ? saved.cube : '';
    const aliases: Record<string, string> = {'guhongpro+': 'guhong pro+', 'dayan guhong pro+': 'guhong pro+', 'moyu rs3m 2020': 'rs3m 2020', 'moyu rs3m v5': 'rs3m v5'};
    const renamedCubes = Object.fromEntries(Object.entries(aliases).filter(([old, renamed]) => loaded.cubes.some(cube => cube.name === renamed) && !loaded.cubes.some(cube => cube.name === old)));
    renameQueuedCubes(user.id, renamedCubes);
    const renamed = aliases[cubeName.value];
    if (renamed && loaded.cubes.some(cube => cube.name === renamed) && !loaded.cubes.some(cube => cube.name === cubeName.value)) cubeName.value = renamed;
    validateShortText(cubeName, cubeValidation);
    const catalogEvents: Record<string,string> = {'3bld':'3x3','3oh':'3x3','3mbld':'3x3','fmc':'3x3','4bld':'4x4','5bld':'5x5'};
    const catalogEvent = catalogEvents[selectedEvent()] ?? selectedEvent();
    // Restore a unique association already recorded on this account's owned cube.
    // This is not a guess from shared catalog aliases.
    const knownCubes = loaded.cubes.filter(cube => cube.name === cubeName.value && cube.catalog_event === catalogEvent && cube.catalog_model_id);
    const selectedModel = typeof saved.cubeModel === 'string' ? saved.cubeModel : knownCubes.length === 1 ? knownCubes[0].catalog_model_id ?? null : null;
    await cubeSelector.configure(selectedEvent(), selectedModel);
    if (user !== nextUser) return;
    hidden.checked = saved.hidden === true;
    scramblesEnabled.checked = saved.scrambles === true;
    fixedTagsEnabled.checked = saved.fixedTags === true;
    hideOutliers.checked = saved.hideOutliers !== false;
    savePreferences();
    solves.push(...pendingSolves(user.id).sort((a, b) => b.started_at.localeCompare(a.started_at)).map(solve => ({ ...solve, pending: true })));
    solveCount = solves.length;
    renderSolves();
  } catch {
    storageStatus.hidden = false;
    setText(storageStatus, 'storage unavailable');
  }
  configureScrambles();
  configureFixedTags();
  eventIcon.update();
  await historyReady;
  if (user !== nextUser) return;
  for (const pending of pendingSolves(nextUser.id)) historyView.store.upsert({...pending,pending:true});
  void syncSolves();
});

function savePreferences(): void {
  if (!user) return;
  try {
    cubeName.value = cubeName.value.toLowerCase();
    localStorage.setItem(preferencesKey(), JSON.stringify({ event: eventSelect.value, cube: cubeName.value, hidden: hidden.checked, scrambles:scramblesEnabled.checked, fixedTags:fixedTagsEnabled.checked, hideOutliers:hideOutliers.checked, language:currentLanguage(), cubeModel:cubeSelector.modelId }));
  } catch {
    storageStatus.hidden = false;
    setText(storageStatus, 'settings unavailable');
  }
}

languageSelect.addEventListener('change', () => {
  setLanguage(languageSelect.value);
  if (!user) return;
  try { rememberLanguage(localStorage,user.id,languageSelect.value); }
  catch { storageStatus.hidden = false; setText(storageStatus,'settings unavailable'); }
});
eventSelect.addEventListener('change', () => { configureFixedTags(); cubeName.value = ''; validateShortText(cubeName, cubeValidation); void cubeSelector.configure(selectedEvent()); configureScrambles(); });
window.addEventListener('online', () => void syncSolves());
window.setInterval(() => void syncSolves(), 15000);
const timerTab = element<HTMLButtonElement>('timer-tab');
const analysisTab = element<HTMLButtonElement>('analysis-tab');
const settings = element<HTMLDetailsElement>('settings-panel');
const history = element<HTMLDetailsElement>('history-panel');
function closeHistory(): void {
  if (!history.open) return;
  history.open = false;
  historyView.close();
}
function closeSettings(): boolean {
  if (!settings.open) return true;
  cubeSelector.close();
  savePreferences();
  settings.open = false;
  return true;
}
settings.addEventListener('toggle', () => {
  if (settings.open) {
    closeScramblePopup();
    if (editorSolve) { settings.open = false; void saveEditor().then(saved => { if (saved) settings.open = true; }); }
    else closeHistory();
  } else { cubeSelector.close(); savePreferences(); }
});
history.querySelector('summary')!.addEventListener('click', () => {
  // Prepare/reset before the native details toggle can paint a previous day.
  if (history.open) historyView.close();
  else if (!editorSolve) historyView.open();
});
history.addEventListener('toggle', () => {
  if (!history.open) { closeScramblePopup(); historyView.close(); }
  if (history.open) {
    if (!closeSettings()) { history.open = false; return; }
    if (editorSolve) {
      history.open = false;
      void saveEditor().then(saved => { if (saved) history.open = true; });
    } else if (!historyView.store.opened) historyView.open();
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
  if (!event.composedPath().includes(history) && !event.composedPath().includes(editor) && !event.composedPath().includes(scramblePopup)) closeHistory();
  if (event.target instanceof Node && !scramblePopup.contains(event.target) && !scrambleButton?.contains(event.target)) closeScramblePopup();
  if (event.target instanceof Node && !editor.contains(event.target) && !editorButton?.contains(event.target) && !(event.target instanceof Element && event.target.closest('[aria-controls="scramble-popup"]'))) void saveEditor();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    // Let the native picker close before dismissing its settings panel.
    if (event.target instanceof Element && event.target.closest('.settings-select-control select')?.matches(':open')) return;
    if (!scramblePopup.hidden) { closeScramblePopup(); return; }
    if (editorSolve) void saveEditor();
    else { closeHistory(); closeSettings(); }
  }
});
window.addEventListener('resize', positionEditor);
window.addEventListener('resize', positionScramblePopup);
async function showPanel(analysis: boolean): Promise<void> {
  if (!closeSettings() || !await saveEditor()) return;
  closeHistory();
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
    dashboard.hide();
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
  hidden.disabled = scramblesEnabled.disabled = fixedTagsEnabled.disabled = hideOutliers.disabled = analysisTab.disabled = eventSelect.disabled = cubeName.disabled = busy || !user;
  languageSelect.disabled = busy || !user;
  replaceScramble.disabled = busy || scrambles.status === 'loading' || !user;
  const logout = element<HTMLButtonElement>('logout');
  const logoutDisabled = busy || savingSolves || deleting || editing;
  if (logout.disabled !== logoutDisabled) logout.disabled = logoutDisabled;
  const labels = {
    IDLE: 'hold to start',
    HOLDING: 'hold',
    READY: 'release',
    RUNNING: 'any key to stop',
    STOPPED: 'hold to start',
  };
  hint.textContent = t(labels[timer.state]);
  if (timer.state !== lastState) {
    if (timer.state === 'READY') setText(element('announcement'), 'release to start');
    lastState = timer.state;
  }
  requestAnimationFrame(render);
}
render();
