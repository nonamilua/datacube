import type { Organization, StoredSolve } from '../api/api';
import { formatTime } from '../timer/timer';
import { filterSolves, presetDates } from './filters';
import { statistics } from './statistics';
import { createCharts } from './charts';
import { comparisonLabels } from './comparisons';
import { icon } from '../icons';

export function setupDashboard() {
  const panel = document.getElementById('analysis-panel')!;
  const select = (id: string) => document.getElementById(id) as HTMLSelectElement;
  const date = (id: string) => document.getElementById(id) as HTMLInputElement;
  const range = select('filter-range');
  const start = date('filter-start');
  const end = date('filter-end');
  const event = select('filter-event');
  const cube = select('filter-cube');
  const custom = select('filter-custom');
  const cards = document.querySelector<HTMLElement>('.analytics-stats')!;
  const next = document.getElementById('stats-next')!;
  next.append(icon('next'));
  next.addEventListener('click', () => {
    cards.dataset.page = cards.dataset.page === '1' ? '2' : '1';
    next.setAttribute('aria-label', cards.dataset.page === '1' ? 'show best statistics' : 'show current statistics');
  });
  let solves: StoredSolve[] = [];
  let dataKey = '';
  let charts: ReturnType<typeof createCharts> | null = null;
  let organization: Organization = {categories: [], cubes: []};

  function render() {
    if (panel.hidden) return;
    const invalid = Boolean(start.value && end.value && start.value > end.value);
    end.setCustomValidity(invalid ? 'choose a later end date' : '');
    const filters = { start: start.value, end: end.value, event: event.value, cube: cube.value, custom: custom.value };
    const filtered = filterSolves(solves, filters);
    const stats = statistics(filtered);
    const values = { count: stats.count, plusTwoCount: stats.plusTwoCount, mean: stats.mean, median: stats.median, best: stats.best, worst: stats.worst, deviation: stats.deviation,
      ao5: stats.ao5, ao12: stats.ao12, ao50: stats.ao50, ao100: stats.ao100,
      bestAo5: stats.bestAo5, bestAo12: stats.bestAo12, bestAo50: stats.bestAo50, bestAo100: stats.bestAo100 };
    for (const [name, value] of Object.entries(values)) {
      document.getElementById(`stat-${name}`)!.textContent = name === 'count' || name === 'plusTwoCount' ? String(value) : value === null ? '' : Number.isFinite(value) ? formatTime(value) : 'dnf';
    }
    for (const [name, value] of Object.entries(comparisonLabels(solves, organization, filters))) {
      const card = document.getElementById(`stat-${name}`)!;
      card.textContent = value ?? '';
      card.title = value ?? '';
      card.dataset.long = String((value?.length ?? 0) > 8);
    }
    const dnfs = document.getElementById('time-dnfs')!;
    dnfs.hidden = stats.dnfCount === 0;
    dnfs.textContent = `${stats.dnfCount} ${stats.dnfCount === 1 ? 'dnf' : 'dnfs'}`;
    const message = document.getElementById('analytics-empty')!;
    message.textContent = invalid ? 'check dates' : filtered.length ? 'no completed times' : 'no solves';
    message.hidden = stats.times.some(Number.isFinite) && !invalid;
    charts ??= createCharts(document.getElementById('time-chart') as HTMLCanvasElement, document.getElementById('histogram-chart') as HTMLCanvasElement);
    charts.update(stats);
  }

  function options(input: HTMLSelectElement, items: Organization['cubes']) {
    const selected = input.value;
    const isEvent = input === event;
    input.replaceChildren(...(isEvent ? [] : [new Option('all', '')]), ...items.map(item => new Option(item.name, String(item.id))));
    const defaultValue = isEvent ? String((items.find(item => item.name === '3x3') ?? items[0])?.id ?? '') : '';
    input.value = items.some(item => String(item.id) === selected) ? selected : defaultValue;
    if (isEvent) input.disabled = items.length === 0;
  }
  for (const input of [start, end, event, cube, custom]) input.addEventListener('change', () => {
    if (input === start || input === end) range.value = 'custom';
    render();
  });
  range.addEventListener('change', () => {
    if (range.value !== 'custom') {
      const dates = presetDates(range.value ? Number(range.value) : null);
      start.value = dates.start; end.value = dates.end;
    }
    render();
  });
  return {
    update(nextSolves: StoredSolve[], nextOrganization: Organization) {
      const key = JSON.stringify([nextSolves, nextOrganization]);
      if (key === dataKey) return;
      dataKey = key; solves = nextSolves; organization = nextOrganization;
      options(event, organization.categories); options(cube, organization.cubes);
      const selectedCustom = custom.value;
      const names = [...new Set(solves.map(solve => solve.custom).filter((name): name is string => Boolean(name)))].sort();
      custom.replaceChildren(new Option('all', ''), ...names.map(name => new Option(name, name)));
      custom.value = names.includes(selectedCustom) ? selectedCustom : '';
      render();
    },
    show() { render(); charts?.resize(); },
    reset() {
      solves = []; dataKey = ''; organization = {categories: [], cubes: []};
      range.value = start.value = end.value = event.value = cube.value = custom.value = '';
      cards.dataset.page = '1'; next.setAttribute('aria-label', 'show best statistics');
      options(event, []); options(cube, []); custom.replaceChildren(new Option('all', '')); render();
    },
  };
}
