import type { Organization, StoredSolve } from '../api/api';
import { formatTime } from '../timer/timer';
import { filterSolves, presetDates, EMPTY_CUSTOM, availableFilters } from './filters';
import { shortRangeLabel } from './range-labels';
import { statistics } from './statistics';
import { createCharts } from './charts';
import { comparisonLabels } from './comparisons';
import { setupCompareView } from './compare-view';
import { icon } from '../icons';
import { t, setText, setActionLabel, onLanguageChange, currentLanguage } from '../i18n';

export function setupDashboard() {
  const panel = document.getElementById('analysis-panel')!;
  const select = (id: string) => document.getElementById(id) as HTMLSelectElement;
  const date = (id: string) => document.getElementById(id) as HTMLInputElement;
  const range = select('filter-range');
  const updateRangeLabel = () => { document.getElementById('range-short-label')!.textContent = shortRangeLabel(range.value,currentLanguage()); };
  updateRangeLabel();
  const start = date('filter-start');
  const end = date('filter-end');
  const viewButtons = document.getElementById('analytics-views')!;
  const overview = document.getElementById('overview-view')!;
  const compare = document.getElementById('compare-view')!;
  const compareView = setupCompareView(() => render());
  const statArea = document.querySelector<HTMLElement>('.analytics-stat-area')!;
  const chartArea = document.querySelector<HTMLElement>('.analytics-charts')!;
  const datesArea = document.getElementById('analytics-dates')!;
  const dateLabels = [start.closest('label')!, end.closest('label')!];
  const popup = document.getElementById('analytics-date-popup') as HTMLDialogElement;
  const popupDates = document.getElementById('popup-dates')!;
  const dateMessage = document.getElementById('date-range-message')!;
  const mobile = window.matchMedia('(max-width: 767px)');
  const customOption = range.querySelector<HTMLOptionElement>('option[value="custom"]')!;
  const pickerOption = range.querySelector<HTMLOptionElement>('option[value="custom-picker"]')!;
  let comparing = false;
  function closeDates() { if (popup.open) popup.close(); }
  function layoutControls() {
    closeDates();
    (mobile.matches ? popupDates : datesArea).append(...dateLabels);
    if (mobile.matches) range.closest('label')!.after(viewButtons);
    else panel.prepend(viewButtons);
    customOption.hidden = mobile.matches;
    pickerOption.hidden = !mobile.matches;
  }
  layoutControls();
  mobile.addEventListener('change', () => { layoutControls(); charts?.resize(); compareView.resize(); });
  function openDates() {
    if (!mobile.matches || popup.open) return;
    popup.showModal();
    const bounds = range.closest('label')!.getBoundingClientRect();
    popup.style.top = `${bounds.top}px`;
    popup.style.left = `${Math.max(16, Math.min(bounds.left, window.innerWidth - popup.offsetWidth - 16))}px`;
  }
  popup.addEventListener('click', event => {
    const bounds = popup.getBoundingClientRect();
    if (event.target === popup && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeDates();
  });
  popup.addEventListener('close', () => { if (!panel.hidden) range.focus({preventScroll:true}); });
  for (const input of [start,end]) input.addEventListener('click', () => {
    if (popup.open) input.showPicker?.();
  });
  function switchView(nextCompare: boolean) {
    comparing = nextCompare;
    overview.setAttribute('aria-pressed', String(!comparing));
    compare.setAttribute('aria-pressed', String(comparing));
    statArea.hidden = chartArea.hidden = comparing;
    compareView.show(comparing);
    render();
    if (!comparing) charts?.resize();
  }
  overview.addEventListener('click', () => switchView(false));
  compare.addEventListener('click', () => switchView(true));
  const event = select('filter-event');
  const cube = select('filter-cube');
  const custom = select('filter-custom');
  const hideOutliers = document.getElementById('hide-outliers') as HTMLInputElement;
  const cards = document.querySelector<HTMLElement>('.analytics-stats')!;
  const next = document.getElementById('stats-next')!;
  next.append(icon('next'));
  next.addEventListener('click', () => {
    cards.dataset.page = cards.dataset.page === '1' ? '2' : '1';
    setActionLabel(next, cards.dataset.page === '1' ? 'show best statistics' : 'show current statistics');
  });
  let solves: StoredSolve[] = [];
  let dataKey = '';
  let charts: ReturnType<typeof createCharts> | null = null;
  let organization: Organization = {categories: [], cubes: []};

  function render() {
    updateRangeLabel();
    const invalid = Boolean(start.value && end.value && start.value > end.value);
    end.setCustomValidity(invalid ? t('choose a later end date') : '');
    dateMessage.hidden = !invalid;
    setText(dateMessage, 'choose a later end date');
    const hours = range.value === '2h' ? 2 : range.value === '4h' ? 4 : undefined;
    const filters = { start: start.value, end: end.value, event: event.value, cube: cube.value, custom: custom.value, hours };
    compareView.update(solves,organization,filters,!panel.hidden && comparing);
    const now = new Date();
    const available = availableFilters(solves, filters, now);
    setOptions(cube, [[t('all'), ''], ...organization.cubes.filter(item => available.cubeIds.includes(String(item.id))).map(item => [item.name, String(item.id)] as [string, string])], available.cube);
    setOptions(custom, [[t('all'), ''], ...available.customValues.map(value => [value === EMPTY_CUSTOM ? t('none') : value, value] as [string, string])], available.custom);
    filters.cube = cube.value;
    filters.custom = custom.value;
    if (panel.hidden || comparing) return;
    const filtered = filterSolves(solves, filters, now);
    const stats = statistics(filtered);
    const values = { count: stats.count, plusTwoCount: stats.plusTwoCount, mean: stats.mean, median: stats.median, best: stats.best, worst: stats.worst, deviation: stats.deviation,
      ao5: stats.ao5, ao12: stats.ao12, ao50: stats.ao50, ao100: stats.ao100,
      bestAo5: stats.bestAo5, bestAo12: stats.bestAo12, bestAo50: stats.bestAo50, bestAo100: stats.bestAo100 };
    for (const [name, value] of Object.entries(values)) {
      document.getElementById(`stat-${name}`)!.textContent = name === 'count' || name === 'plusTwoCount' ? String(value) : value === null ? '' : Number.isFinite(value) ? formatTime(value) : 'dnf';
    }
    for (const [name, value] of Object.entries(comparisonLabels(solves, organization, filters, now))) {
      const card = document.getElementById(`stat-${name}`)!;
      card.textContent = value ?? '';
      card.title = value ?? '';
      card.dataset.long = String((value?.length ?? 0) > 8);
    }
    const dnfs = document.getElementById('time-dnfs')!;
    dnfs.hidden = stats.dnfCount === 0;
    dnfs.textContent = `${stats.dnfCount} ${stats.dnfCount === 1 ? 'dnf' : 'dnfs'}`;
    const message = document.getElementById('analytics-empty')!;
    setText(message, invalid ? 'check dates' : filtered.length ? 'no completed times' : 'no solves');
    message.hidden = stats.times.some(Number.isFinite) && !invalid;
    charts ??= createCharts(document.getElementById('time-chart') as HTMLCanvasElement, document.getElementById('histogram-chart') as HTMLCanvasElement);
    charts.update(stats, hideOutliers.checked);
  }

  function setOptions(input: HTMLSelectElement, items: [string, string][], selected: string) {
    // Background updates must not rebuild a dropdown whose options have not changed.
    if (input.options.length !== items.length || items.some(([label, value], index) => input.options[index]?.textContent !== label || input.options[index]?.value !== value)) {
      input.replaceChildren(...items.map(([label, value]) => new Option(label, value)));
    }
    input.value = selected;
  }
  function eventOptions() {
    const items = organization.categories;
    const selected = items.some(item => String(item.id) === event.value) ? event.value
      : String((items.find(item => item.name === '3x3') ?? items[0])?.id ?? '');
    setOptions(event, items.map(item => [item.name, String(item.id)]), selected);
    event.disabled = items.length === 0;
  }
  hideOutliers.addEventListener('change', render);
  for (const input of [start, end, event, cube, custom]) input.addEventListener('change', () => {
    if (input === start || input === end) range.value = 'custom';
    render();
    if ((input === start || input === end) && start.value && end.value && start.value <= end.value) closeDates();
  });
  range.addEventListener('change', () => {
    // A distinct command option lets selecting custom fire change repeatedly on mobile.
    if (range.value === 'custom-picker') range.value = 'custom';
    if (range.value === 'custom') openDates();
    if (range.value !== 'custom') {
      const hourly = range.value === '2h' || range.value === '4h';
      const dates = presetDates(range.value && !hourly ? Number(range.value) : null);
      start.value = dates.start; end.value = dates.end;
    }
    render();
  });
  // Refresh rolling hour windows even when no new solves arrive.
  window.setInterval(() => {
    if (range.value === '2h' || range.value === '4h') render();
  }, 60000);
  onLanguageChange(() => {
    for (const input of [cube,custom]) {
      const all = Array.from(input.options).find(option => option.value === '');
      if (all) all.textContent = t('all');
    }
    const none = Array.from(custom.options).find(option => option.value === EMPTY_CUSTOM);
    if (none) none.textContent = t('none');
    setActionLabel(next,cards.dataset.page === '1' ? 'show best statistics' : 'show current statistics');
    render();
  });
  return {
    update(nextSolves: StoredSolve[], nextOrganization: Organization) {
      const key = JSON.stringify([nextSolves, nextOrganization]);
      if (key === dataKey) return;
      dataKey = key; solves = nextSolves; organization = nextOrganization;
      eventOptions();
      render();
    },
    show() { render(); if (comparing) compareView.resize(); else charts?.resize(); },
    reset() {
      closeDates();
      solves = []; dataKey = ''; organization = {categories: [], cubes: []};
      range.value = start.value = end.value = event.value = cube.value = custom.value = '';
      cards.dataset.page = '1'; setActionLabel(next,'show best statistics');
      comparing = false;
      compareView.reset();
      overview.setAttribute('aria-pressed','true'); compare.setAttribute('aria-pressed','false');
      statArea.hidden = chartArea.hidden = false;
      eventOptions(); render();
    },
  };
}
