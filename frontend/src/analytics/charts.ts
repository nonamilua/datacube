import { Chart, Interaction, LineController, BarController, LineElement, PointElement, BarElement, LinearScale, CategoryScale, Tooltip, Legend, type InteractionModeFunction } from 'chart.js';
import { drawPoint } from 'chart.js/helpers';
import { histogram, intervalPercentage, timePlot, type statistics } from './statistics';
import { solveCountTicks, timeAxis, distributionAxis } from './axes';
import { formatTime } from '../timer/timer';
import { t } from '../i18n';
import { solveDateTitle, solveTooltipValues } from './solve-tooltip';
import { chartScale, symbolDimensions, chartPixelRatio } from './presentation';
import { evenlySpacedIndexes } from './time-sampling';
Chart.register(LineController, BarController, LineElement, PointElement, BarElement, LinearScale, CategoryScale, Tooltip, Legend);

declare module 'chart.js' {
  interface InteractionModeMap { solvePosition: InteractionModeFunction }
}

type TimePoint = {x: number; y: number | null};

Interaction.modes.solvePosition = (chart, event, options, useFinalPosition) => {
  const nearest = Interaction.modes.nearest(chart, event, options, useFinalPosition)[0];
  if (!nearest) return [];
  const point = chart.data.datasets[nearest.datasetIndex].data[nearest.index] as TimePoint;
  // Only highlight drawn points that belong to the same solve as the nearest point.
  return chart.getSortedVisibleDatasetMetas().flatMap(meta => {
    const points = chart.data.datasets[meta.index].data as TimePoint[];
    const index = points.findIndex(candidate => candidate.x === point.x && candidate.y !== null);
    return index < 0 ? [] : [{element: meta.data[index], datasetIndex: meta.index, index}];
  });
};

const TIME = 0, AO50 = 3, AO100 = 4, BEST = 5;

export function createCharts(lineCanvas: HTMLCanvasElement, histogramCanvas: HTMLCanvasElement, isVisible: () => boolean) {
  const style = getComputedStyle(document.documentElement);
  const color = (name: string) => style.getPropertyValue(name).trim();
  Chart.defaults.font.family = style.getPropertyValue('--bs-body-font-family').trim();
  Chart.defaults.font.size = 10;
  Chart.defaults.color = color('--muted');
  let solveTicks: number[] = [];
  let timeTicks: number[] = [];
  let dotsOnly = false;
  let visibleTimeCount = 0;
  const visibilityOverrides = new Map<number, boolean>();
  let timeSeries: (number | null)[][] = [];
  let sampledTarget = 0;
  let solveTimestamps: readonly string[] = [];
  let scale = chartScale();
  let symbolRatio = chartPixelRatio();
  const mobile = window.matchMedia('(max-width: 767px)');
  const wide = window.matchMedia('(width > 1400px)');
  const timesTooltip = document.createElement('div');
  timesTooltip.className = 'times-tooltip';
  timesTooltip.hidden = true;
  timesTooltip.setAttribute('aria-hidden', 'true');
  lineCanvas.parentElement!.append(timesTooltip);
  // High-resolution sources with explicit logical dimensions avoid blurry or oversized symbols.
  function legendPoint(pointStyle: 'circle' | 'rectRot', radius: number, fill: string, borderWidth: number) {
    const {logical, backing} = symbolDimensions(8, scale, chartPixelRatio());
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = backing;
    const context = canvas.getContext('2d')!;
    context.scale(backing / logical, backing / logical);
    context.fillStyle = context.strokeStyle = fill;
    context.lineWidth = borderWidth * scale;
    drawPoint(context, {pointStyle, radius:radius * scale, borderWidth:borderWidth * scale, rotation:0}, logical / 2, logical / 2);
    const image = new Image(logical, logical);
    image.src = canvas.toDataURL();
    image.onload = () => { if (isVisible()) line.draw(); };
    return image;
  }
  let timeSymbol: HTMLImageElement;
  let bestSymbol: HTMLImageElement;
  const line = new Chart<'line', TimePoint[]>(lineCanvas, {
    plugins: [{id: 'timesPointer', beforeEvent(_chart, {event}) {
      // Touch uses click. Ignore its pointerout when the finger lifts.
      if (event.native instanceof PointerEvent && event.native.pointerType === 'touch' && event.native.type !== 'click') return false;
    }}],
    type: 'line', data: { labels: [], datasets: [
      // Chart.js draws lower order values on top, independently of the legend order.
      // DNF values are null: omit them and connect the surrounding valid times.
      { label: 'time', data: [], borderColor: color('--muted'), backgroundColor: color('--muted'), borderWidth: 1, pointBorderWidth: 0, pointRadius: 0, pointHitRadius: 8, spanGaps: true, order: 5 },
      { label: 'ao5', data: [], borderColor: color('--holding'), borderWidth: 2, pointRadius: 0, order: 4 },
      { label: 'ao12', data: [], borderColor: color('--compare-violet'), borderWidth: 2, pointRadius: 0, order: 3 },
      { label: 'ao50', data: [], borderColor: color('--ready'), borderWidth: 2, pointRadius: 0, hidden: true, order: 2 },
      { label: 'ao100', data: [], borderColor: color('--compare-pink'), borderWidth: 2, pointRadius: 0, hidden: true, order: 1 },
      { label: 'best', data: [], borderColor: color('--bs-body-color'), backgroundColor: color('--bs-body-color'), pointHoverBackgroundColor: color('--bs-body-color'), pointHoverBorderColor: color('--bs-body-color'), borderWidth: 2, pointRadius: 2, pointStyle: 'rectRot', spanGaps: true, order: 0 },
    ] },
    options: { responsive: true, maintainAspectRatio: false, devicePixelRatio: chartPixelRatio(), animation: false,
      events: ['pointermove', 'pointerout', 'click'],
      interaction: { mode: 'solvePosition', axis: 'x', intersect: false },
      plugins: { legend: { position: 'bottom', onClick(event, item, legend) {
        const index = item.datasetIndex;
        if (index === TIME || index === AO50 || index === AO100) {
          visibilityOverrides.set(index, !line.isDatasetVisible(index));
          applySeriesVisibility();
          updateTimeAxis();
          line.update('none');
        } else Chart.defaults.plugins.legend.onClick.call(this, event, item, legend);
      }, labels: {
        boxWidth: 12, boxHeight: 8, padding: 8, usePointStyle: true,
        generateLabels: chart => Chart.defaults.plugins.legend.labels.generateLabels(chart).sort((a, b) => a.datasetIndex! - b.datasetIndex!).map(item => ({
          ...item, pointStyle: dotsOnly && item.datasetIndex === BEST ? bestSymbol : dotsOnly && item.datasetIndex === TIME ? timeSymbol : 'line',
        })),
      } }, tooltip: { enabled: false, external({chart, tooltip}) {
        const position = tooltip.dataPoints[0]?.parsed.x;
        if (!tooltip.opacity || position == null) { timesTooltip.hidden = true; return; }
        const date = document.createElement('div');
        date.className = 'times-tooltip-date';
        date.textContent = solveDateTitle(position, solveTimestamps);
        const rows = solveTooltipValues(position, timeSeries, index => chart.isDatasetVisible(index)).map(({index, value}) => {
          const row = document.createElement('div');
          row.className = 'times-tooltip-value';
          const marker = document.createElement('span');
          marker.style.backgroundColor = chart.data.datasets[index].borderColor as string;
          row.append(marker, formatTime(Math.round(value)));
          return row;
        });
        timesTooltip.replaceChildren(...(date.textContent ? [date, ...rows] : rows));
        timesTooltip.hidden = rows.length === 0;
        const gap = 8 * scale;
        const right = tooltip.caretX + gap;
        const left = tooltip.caretX - gap - timesTooltip.offsetWidth;
        timesTooltip.style.left = `${Math.max(0, right + timesTooltip.offsetWidth <= chart.width ? right : left)}px`;
        timesTooltip.style.top = `${Math.max(0, Math.min(tooltip.caretY - timesTooltip.offsetHeight / 2, chart.height - timesTooltip.offsetHeight))}px`;
      } } },
      scales: {
        x: { type: 'linear', min: 1, max: 2, grid: { display: false },
          afterBuildTicks: scale => { scale.ticks = solveTicks.map(value => ({value})); },
          ticks: { autoSkip: false, minRotation: 0, maxRotation: 0, precision: 0 },
        },
        y: { grid: { color: color('--list-border') },
          afterBuildTicks: scale => { scale.ticks = timeTicks.map(value => ({value})); },
          ticks: { autoSkip: false, maxTicksLimit: 5 },
        },
      },
    },
  });
  let histogramBoundaries: number[] = [];
  let histogramTotal = 0;
  let histogramTicks: number[] = [];
  const bars = new Chart<'bar', {x: number; y: number}[]>(histogramCanvas, {
    type: 'bar', data: { labels: [], datasets: [{ label: 'solves', data: [], backgroundColor: color('--ready'), categoryPercentage: 1, barPercentage: 1, borderWidth: 1, borderColor: color('--bs-body-bg') }] },
    options: { responsive: true, maintainAspectRatio: false, devicePixelRatio: chartPixelRatio(), animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false, callbacks: {
          title: items => {
            const count = items[0]?.parsed.y;
            return count == null ? '' : `${t('count')} ${count} (${intervalPercentage(count, histogramTotal)})`;
          },
          label: item => `${histogramBoundaries[item.dataIndex].toFixed(1)} ⊢ ${histogramBoundaries[item.dataIndex + 1].toFixed(1)}`,
        } },
      },
      scales: {
        x: { type: 'linear', offset: false, min: 0, max: 1,
          grid: { display: false, offset: false },
          // Numeric ticks sit on every bin edge, including the final upper edge.
          afterBuildTicks: scale => { scale.ticks = histogramBoundaries.map(value => ({value})); },
          ticks: {
          autoSkip: false, minRotation: 0, maxRotation: 0, font: { size: 9 },
          callback: value => Number(value).toFixed(1),
        } },
        y: { beginAtZero: true, min: 0, grid: { color: color('--list-border') },
          afterBuildTicks: scale => { scale.ticks = histogramTicks.map(value => ({value})); },
          ticks: { autoSkip: false, precision: 0 },
        },
      },
    },
  });
  function applySeriesVisibility() {
    line.setDatasetVisibility(TIME, visibilityOverrides.get(TIME) ?? visibleTimeCount <= 1000);
    for (const index of [AO50, AO100]) line.setDatasetVisibility(index, visibilityOverrides.get(index) ?? false);
  }
  function updateTimeAxis() {
    const axis = timeAxis(timeSeries.flatMap((values, index) =>
      (index === AO50 || index === AO100) && !line.isDatasetVisible(index) ? [] : values.map(value => value === null ? null : value / 1000),
    ));
    timeTicks = axis.ticks;
    line.options.scales!.y!.min = axis.min;
    line.options.scales!.y!.max = axis.max;
  }
  function sampleTimeSeries() {
    if (!timeSeries.length) return;
    const target = Math.min(timeSeries[TIME].length, mobile.matches ? 600 : 1200);
    if (target === sampledTarget) return;
    sampledTarget = target;
    const indexes = evenlySpacedIndexes(timeSeries[TIME].length, target);
    for (const [index, values] of timeSeries.entries()) {
      // Personal bests have their own series so they can all be retained.
      line.data.datasets[index].data = index === BEST
        ? values.flatMap((value, i) => value !== null ? [{x: i + 1, y: value / 1000}] : [])
        : indexes.map(i => ({x: i + 1, y: values[i] !== null && Number.isFinite(values[i]) ? values[i]! / 1000 : null}));
    }
    updateLineWidths();
  }
  function updateLineWidths() {
    const mobileAverageWidth = visibleTimeCount >= 500 ? 1.5 : 2;
    const denseDesktopWidth = wide.matches ? 2 : 1.5;
    for (const [index, dataset] of line.data.datasets.entries()) {
      if (index === TIME || index === BEST) {
        dataset.borderWidth = (index === TIME ? 1 : 2) * scale;
      } else if (mobile.matches) {
        dataset.borderWidth = mobileAverageWidth;
      } else {
        const anchors = dataset.data.reduce((count, point) => count + Number(point.y !== null), 0);
        dataset.borderWidth = anchors > 600 ? denseDesktopWidth : 2 * scale;
      }
    }
  }
  function resizePresentation(redraw = true) {
    if (!isVisible()) return;
    scale = chartScale();
    symbolRatio = chartPixelRatio();
    timeSymbol = legendPoint('circle', 1.2, color('--muted'), 0);
    bestSymbol = legendPoint('rectRot', 2, color('--bs-body-color'), 2);
    for (const chart of [line, bars]) {
      chart.options.devicePixelRatio = symbolRatio;
      chart.options.font = {size:10 * scale};
      for (const axis of Object.values(chart.options.scales!)) {
        axis!.ticks!.font = {size:10 * scale};
        axis!.ticks!.padding = 3 * scale;
        axis!.grid!.tickLength = 8 * scale;
        axis!.grid!.lineWidth = scale;
      }
      const tooltip = chart.options.plugins!.tooltip!;
      tooltip.titleFont = {size:10 * scale, weight:400}; tooltip.bodyFont = {size:10 * scale, weight:400};
      tooltip.padding = 6 * scale; tooltip.boxWidth = tooltip.boxHeight = 10 * scale;
    }
    bars.options.scales!.x!.ticks!.font = {size:9 * scale};
    bars.data.datasets[0].borderWidth = scale;
    const labels = line.options.plugins!.legend!.labels!;
    labels.font = {size:10 * scale}; labels.boxWidth = 12 * scale;
    labels.boxHeight = 8 * scale; labels.padding = 8 * scale;
    updateLineWidths();
    for (const [index,dataset] of line.data.datasets.entries()) {
      dataset.pointRadius = index === BEST ? 2 * scale : index === TIME && dotsOnly ? 1.2 * scale : 0;
      dataset.pointBorderWidth = index === 0 ? 0 : scale;
      dataset.pointHitRadius = (index === 0 ? 8 : 1) * scale;
      dataset.pointHoverRadius = (index === BEST ? 3.25 : index === TIME ? 2.5 : 2) * scale;
      dataset.pointHoverBorderWidth = (index === BEST ? 1 : index === TIME ? 0 : 0.5) * scale;
    }
    line.resize(); bars.resize();
    if (redraw) { applySeriesVisibility(); updateTimeAxis(); sampleTimeSeries(); line.update('none'); bars.update('none'); }
  }
  document.addEventListener('pointerdown', event => {
    if (timesTooltip.hidden || event.target === lineCanvas) return;
    timesTooltip.hidden = true;
    line.setActiveElements([]);
    line.tooltip?.setActiveElements([], {x: 0, y: 0});
    if (isVisible()) line.draw();
  });
  resizePresentation();
  wide.addEventListener('change', () => resizePresentation());
  window.addEventListener('resize', () => {
    if (symbolRatio !== chartPixelRatio()) resizePresentation();
  });
  return {
    update(stats: ReturnType<typeof statistics>, hideOutliers = false, timestamps: readonly string[] = []) {
      solveTimestamps = timestamps;
      if (scale !== chartScale() || symbolRatio !== chartPixelRatio()) resizePresentation(false);
      const plot = timePlot(stats, hideOutliers);
      const outliers = document.getElementById('time-outliers')!;
      outliers.hidden = plot.omitted === 0;
      outliers.textContent = `${plot.omitted} ${t(plot.omitted === 1 ? 'outlier' : 'outliers')}`;
      line.data.datasets[TIME].label = t('time');
      line.data.datasets[BEST].label = t('best');
      bars.data.datasets[0].label = t('solves');
      visibleTimeCount = plot.times.filter(time => time !== null && Number.isFinite(time)).length;
      dotsOnly = visibleTimeCount > 100;
      applySeriesVisibility();
      for (const index of [TIME,BEST]) {
        line.data.datasets[index].showLine = !dotsOnly;
      }
      line.data.datasets[TIME].pointRadius = dotsOnly ? 1.2 * scale : 0;
      solveTicks = solveCountTicks(stats.times.length);
      timeSeries = [plot.times, plot.rolling5, plot.rolling12, plot.rolling50, plot.rolling100, plot.bestProgression];
      updateTimeAxis();
      line.options.scales!.x!.max = Math.max(2, stats.times.length);
      sampledTarget = -1;
      sampleTimeSeries();
      const distribution = histogram(stats.times);
      histogramTotal = distribution.counts.reduce((total, count) => total + count, distribution.omitted);
      const countAxis = distributionAxis(distribution.counts);
      histogramTicks = countAxis.ticks;
      bars.options.scales!.y!.max = countAxis.max;
      const omitted = document.getElementById('histogram-outliers')!;
      omitted.hidden = distribution.omitted === 0;
      omitted.textContent = `${distribution.omitted} ${t(distribution.omitted === 1 ? 'outlier' : 'outliers')}`;
      histogramCanvas.setAttribute('aria-label', `${t('solve time histogram')} ${distribution.omitted} ${t('outliers hidden')}`);
      histogramBoundaries = distribution.boundaries;
      bars.options.scales!.x!.min = histogramBoundaries[0] ?? 0;
      bars.options.scales!.x!.max = histogramBoundaries.at(-1) ?? 1;
      bars.data.datasets[0].data = distribution.counts.map((count, index) => ({
        x: (histogramBoundaries[index] + histogramBoundaries[index + 1]) / 2, y: count,
      }));
      line.update('none'); bars.update('none');
    },
    resize() { resizePresentation(); },
    resetSeriesVisibility() { visibilityOverrides.clear(); },
    clear() {
      timesTooltip.hidden = true;
      solveTimestamps = [];
      visibleTimeCount = 0; visibilityOverrides.clear(); timeSeries = [];
      solveTicks = []; timeTicks = []; histogramTicks = []; histogramBoundaries = []; histogramTotal = 0;
      for (const chart of [line,bars]) { for (const dataset of chart.data.datasets) dataset.data = []; chart.clear(); }
    },
  };
}
