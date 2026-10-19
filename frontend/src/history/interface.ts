import { loadHistory, type StoredSolve } from '../api/api';
import { icon } from '../icons';
import { currentLanguage, onLanguageChange, setActionLabel, setText, t } from '../i18n';
import { HistoryStore } from './store';

export function setupHistory(makeRow: (solve: StoredSolve) => HTMLLIElement, updateRow: (row: HTMLLIElement, solve: StoredSolve) => void, beforeFilter: () => Promise<boolean>) {
  const panel = document.querySelector<HTMLElement>('.history-content')!;
  const list = document.getElementById('recent-solves')!;
  const filter = document.getElementById('history-filter') as HTMLButtonElement;
  const label = document.getElementById('history-day-label')!;
  const date = document.getElementById('history-date') as HTMLInputElement;
  const clear = document.getElementById('history-clear') as HTMLButtonElement;
  const status = document.getElementById('history-status')!;
  const spinner = document.getElementById('history-spinner')!;
  const retry = document.getElementById('history-retry') as HTMLButtonElement;
  const empty = document.getElementById('empty-message')!;
  const nodes = new Map<string,HTMLLIElement>();
  filter.prepend(icon('filter'));
  clear.append(icon('clear'));

  const store = new HistoryStore(loadHistory,render);
  function render(): void {
    date.value = store.day;
    label.textContent = store.day ? new Date(`${store.day}T12:00:00`).toLocaleDateString(currentLanguage(),{day:'numeric',month:'short',year:'numeric'}).toLowerCase() : t('all');
    clear.hidden = !store.day;
    setActionLabel(filter,'filter history',` ${label.textContent}`);
    setActionLabel(clear,'clear');
    setActionLabel(date,'filter history');
    const ids = new Set(store.rows.map(solve => solve.id));
    for (const [id,node] of nodes) if (!ids.has(id)) { node.remove(); nodes.delete(id); }
    // Move only changed positions; existing buttons and popup anchors stay connected.
    let previous: HTMLLIElement | null = null;
    for (const solve of store.rows) {
      let node = nodes.get(solve.id);
      if (!node) { node = makeRow(solve); nodes.set(solve.id,node); }
      else updateRow(node,solve);
      const expected: Element | null = previous ? previous.nextElementSibling : list.firstElementChild;
      if (expected !== node) list.insertBefore(node,expected);
      previous = node;
    }
    spinner.hidden = !store.loading;
    status.hidden = !store.loading && !store.error;
    setText(document.getElementById('history-status-text')!,store.loading ? 'loading history' : 'history unavailable');
    retry.hidden = !store.error || store.loading;
    setText(retry,'retry');
    empty.hidden = store.rows.length > 0 || store.loading || store.error || !store.cacheReady && !store.day;
    setText(empty,'no solves');
  }
  filter.addEventListener('click', () => {
    // Run inside the user gesture so Chrome can open its native anchored picker.
    date.focus({preventScroll:true});
    try { date.showPicker(); } catch { date.classList.add('picker-fallback'); }
  });
  date.addEventListener('change', () => void (async () => {
    const day = date.value;
    if (!await beforeFilter()) { date.value = store.day; return; }
    date.classList.remove('picker-fallback'); filter.focus({preventScroll:true});
    panel.scrollTop = 0;
    store.filter(day);
  })());
  clear.addEventListener('click', () => void (async () => {
    if (!await beforeFilter()) return;
    panel.scrollTop = 0; store.filter(''); filter.focus({preventScroll:true});
  })());
  retry.addEventListener('click', () => void store.retry());
  panel.addEventListener('scroll', () => {
    if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 24) void store.more();
  }, {passive:true});
  onLanguageChange(render);
  return {
    store,
    open() { panel.scrollTop = 0; store.open(); },
    close() { panel.scrollTop = 0; store.close(); },
    render,
  };
}
