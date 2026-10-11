import type { Organization, StoredSolve } from '../api/api';
import { formatTime } from '../timer/timer';
import { filterSolves, presetDates, EMPTY_CUSTOM, availableFilters } from './filters';
import { shortRangeLabel } from './range-labels';
import { statistics } from './statistics';
import { createCharts } from './charts';
import { comparisonLabels } from './comparisons';
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
    const hours = range.value === '2h' ? 2 : range.value === '4h' ? 4 : undefined;
    const filters = { start: start.value, end: end.value, event: event.value, cube: cube.value, custom: custom.value, hours };
    const now = new Date();
    const available = availableFilters(solves, filters, now);
    setOptions(cube, [[t('all'), ''], ...organization.cubes.filter(item => available.cubeIds.includes(String(item.id))).map(item => [item.name, String(item.id)] as [string, string])], available.cube);
    setOptions(custom, [[t('all'), ''], ...available.customValues.map(value => [value === EMPTY_CUSTOM ? t('none') : value, value] as [string, string])], available.custom);
    filters.cube = cube.value;
    filters.custom = custom.value;
    if (panel.hidden) return;
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
  });
  range.addEventListener('change', () => {
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
    show() { render(); charts?.resize(); },
    reset() {
      solves = []; dataKey = ''; organization = {categories: [], cubes: []};
      range.value = start.value = end.value = event.value = cube.value = custom.value = '';
      cards.dataset.page = '1'; setActionLabel(next,'show best statistics');
      eventOptions(); render();
    },
  };
}
