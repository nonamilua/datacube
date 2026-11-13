import type { StoredSolve } from '../api/api';
import { onLanguageChange, t } from '../i18n';
import { activityBand, activityDays, activityLayout, countActivity } from './activity';
import { solveLocalDate } from './solve-tooltip';

export function setupActivityView() {
  const grid = document.getElementById('activity-grid')!;
  const tooltip = document.getElementById('activity-tooltip')!;
  const [tooltipDate, tooltipCount] = Array.from(tooltip.children);
  let history: readonly StoredSolve[] | undefined;
  let counts = new Map<string, number>();
  let now = new Date();
  let today = solveLocalDate(now);
  let rows: (HTMLElement | null)[][] = [];
  let weeks = 0;
  let dirty = true;
  let current: HTMLElement | undefined;

  function hideTooltip() { tooltip.hidden = true; }

  function countLabel(count: number) {
    return `${count} ${t(count === 1 ? 'solve' : 'solves')}`;
  }

  function showTooltip(cell: HTMLElement) {
    tooltipDate.textContent = cell.dataset.date!;
    tooltipCount.textContent = countLabel(Number(cell.dataset.count));
    tooltip.hidden = false;
    const target = cell.getBoundingClientRect();
    const {width, height} = tooltip.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = (viewport?.offsetLeft ?? 0) + 4;
    const top = (viewport?.offsetTop ?? 0) + 4;
    const right = left + (viewport?.width ?? window.innerWidth) - 8;
    const bottom = top + (viewport?.height ?? window.innerHeight) - 8;
    const above = target.top - height - 6;
    const y = above >= top ? above : target.bottom + 6;
    tooltip.style.left = `${Math.max(left, Math.min((target.left + target.right - width) / 2, right - width))}px`;
    tooltip.style.top = `${Math.max(top, Math.min(y, bottom - height))}px`;
  }

  function select(cell: HTMLElement) {
    if (current) current.tabIndex = -1;
    current = cell;
    current.tabIndex = 0;
  }

  function render() {
    const {cell, weeks: nextWeeks} = activityLayout(grid.clientWidth, grid.clientHeight, parseFloat(getComputedStyle(grid).rowGap));
    if (!nextWeeks) { hideTooltip(); return; }
    grid.style.setProperty('--activity-cell', `${cell}px`);
    grid.style.setProperty('--activity-weeks', String(nextWeeks));
    if (nextWeeks === weeks && !dirty) return;
    weeks = nextWeeks;
    dirty = false;

    const selectedDate = current?.dataset.date ?? today;
    const hadFocus = grid.contains(document.activeElement);
    const cells = new Map<string, HTMLElement>();
    const fragment = document.createDocumentFragment();
    rows = activityDays(counts, weeks, now).map((days, weekday) => {
      const row = document.createElement('div');
      row.className = 'activity-row';
      row.setAttribute('role','row');
      fragment.append(row);
      return days.map((day, week) => {
        const element = document.createElement('div');
        row.append(element);
        if (!day) { element.setAttribute('aria-hidden','true'); return null; }
        element.className = 'activity-cell';
        element.dataset.date = day.date;
        element.dataset.count = String(day.count);
        element.dataset.band = String(activityBand(day.count));
        element.dataset.week = String(week);
        element.dataset.weekday = String(weekday);
        element.setAttribute('role','gridcell');
        element.setAttribute('aria-label', `${day.date}, ${countLabel(day.count)}`);
        element.tabIndex = -1;
        cells.set(day.date, element);
        return element;
      });
    });
    hideTooltip();
    grid.replaceChildren(fragment);
    select(cells.get(selectedDate) ?? cells.get(today)!);
    if (hadFocus) current?.focus({preventScroll:true});
  }

  function targetCell(target: EventTarget | null) {
    return target instanceof HTMLElement ? target.closest<HTMLElement>('.activity-cell') : null;
  }

  grid.addEventListener('pointerover', event => {
    const cell = targetCell(event.target);
    if (cell && event.pointerType === 'mouse') showTooltip(cell);
  });
  grid.addEventListener('pointerout', event => {
    if (event.pointerType !== 'mouse' || targetCell(event.relatedTarget)) return;
    if (current && document.activeElement === current && current.matches(':focus-visible')) showTooltip(current);
    else hideTooltip();
  });
  grid.addEventListener('click', event => {
    const cell = targetCell(event.target);
    if (cell) { select(cell); showTooltip(cell); }
  });
  grid.addEventListener('focusin', event => {
    const cell = targetCell(event.target);
    if (cell) { select(cell); if (cell.matches(':focus-visible')) showTooltip(cell); }
  });
  grid.addEventListener('focusout', event => { if (!targetCell(event.relatedTarget)) hideTooltip(); });
  grid.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !tooltip.hidden) { hideTooltip(); event.stopPropagation(); return; }
    const cell = targetCell(event.target);
    if (!cell) return;
    const weekday = Number(cell.dataset.weekday);
    const week = Number(cell.dataset.week);
    let next: HTMLElement | null | undefined;
    switch (event.key) {
      case 'ArrowLeft': next = rows[weekday][week - 1]; break;
      case 'ArrowRight': next = rows[weekday][week + 1]; break;
      case 'ArrowUp': next = rows[weekday - 1]?.[week]; break;
      case 'ArrowDown': next = rows[weekday + 1]?.[week]; break;
      case 'Home': next = rows[weekday].find(Boolean); break;
      case 'End': next = rows[weekday][weeks - 1] ?? rows[weekday][weeks - 2]; break;
      default: return;
    }
    event.preventDefault();
    next?.focus({preventScroll:true});
  });

  document.addEventListener('pointerdown', event => { if (!targetCell(event.target)) hideTooltip(); });
  document.addEventListener('scroll', hideTooltip, true);
  new ResizeObserver(() => { hideTooltip(); render(); }).observe(grid);
  onLanguageChange(() => { dirty = true; render(); });

  return {
    update(solves: readonly StoredSolve[], date = new Date()) {
      const day = solveLocalDate(date);
      if (history === solves && today === day) return;
      if (history !== solves) counts = countActivity(solves);
      history = solves;
      now = date;
      today = day;
      dirty = true;
      render();
    },
    hideTooltip,
  };
}
