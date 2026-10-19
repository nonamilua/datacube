import { Chart, LineController, BarController, LineElement, PointElement, BarElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';
import { drawPoint } from 'chart.js/helpers';
import { histogram, intervalPercentage, timePlot, type statistics } from './statistics';
import { solveCountTicks, timeAxis, distributionAxis } from './axes';
import { formatTime } from '../timer/timer';
import { t } from '../i18n';
import { solveDateTitle } from './solve-tooltip';
import { chartScale, symbolDimensions, chartPixelRatio } from './presentation';
Chart.register(LineController, BarController, LineElement, PointElement, BarElement, LinearScale, CategoryScale, Tooltip, Legend);

export function createCharts(lineCanvas: HTMLCanvasElement, histogramCanvas: HTMLCanvasElement, isVisible: () => boolean) {
  const style = getComputedStyle(document.documentElement);
  const color = (name: string) => style.getPropertyValue(name).trim();
  Chart.defaults.font.family = style.getPropertyValue('--bs-body-font-family').trim();
  Chart.defaults.font.size = 10;
  Chart.defaults.color = color('--muted');
  let solveTicks: number[] = [];
  let timeTicks: number[] = [];
  let dotsOnly = false;
  let solveTimestamps: readonly string[] = [];
  let scale = chartScale();
  let symbolRatio = chartPixelRatio();
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
  const line = new Chart<'line', {x: number; y: number | null}[]>(lineCanvas, {
    type: 'line', data: { labels: [], datasets: [
      // DNF values are null: omit them and connect the surrounding valid times.
      { label: 'time', data: [], borderColor: color('--muted'), backgroundColor: color('--muted'), borderWidth: 1, pointBorderWidth: 0, pointRadius: 0, pointHitRadius: 8, spanGaps: true },
      { label: 'ao5', data: [], borderColor: color('--holding'), borderWidth: 2, pointRadius: 0 },
      { label: 'ao12', data: [], borderColor: color('--checkbox-bg'), borderWidth: 2, pointRadius: 0 },
      // Lower drawing order paints best points last, above overlapping time points.
      { label: 'best', data: [], borderColor: color('--ready'), backgroundColor: color('--ready'), borderWidth: 2, pointRadius: 2, pointStyle: 'rectRot', spanGaps: true, order: -1 },
    ] },
    options: { responsive: true, maintainAspectRatio: false, devicePixelRatio: chartPixelRatio(), animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: {
        boxWidth: 12, boxHeight: 8, padding: 8, usePointStyle: true,
        generateLabels: chart => Chart.defaults.plugins.legend.labels.generateLabels(chart).sort((a, b) => a.datasetIndex! - b.datasetIndex!).map(item => ({
          ...item, pointStyle: dotsOnly && item.datasetIndex === 3 ? bestSymbol : dotsOnly && item.datasetIndex === 0 ? timeSymbol : 'line',
        })),
      } }, tooltip: { titleColor: color('--muted'), callbacks: {
        title: items => solveDateTitle(items[0]?.parsed.x ?? undefined, solveTimestamps),
        label: item => formatTime(Math.round(item.parsed.y! * 1000)),
        labelColor: item => ({
          backgroundColor: item.dataset.borderColor as string,
          borderColor: item.dataset.borderColor as string,
          borderWidth: 0,
        }),
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
    type: 'bar', data: { labels: [], datasets: [{ label: 'solves', data: [], backgroundColor: color('--accent'), categoryPercentage: 1, barPercentage: 1, borderWidth: 1, borderColor: color('--bs-body-bg') }] },
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
  function resizePresentation(redraw = true) {
    if (!isVisible()) return;
    scale = chartScale();
    symbolRatio = chartPixelRatio();
    timeSymbol = legendPoint('circle', 1.2, color('--muted'), 0);
    bestSymbol = legendPoint('rectRot', 2, color('--ready'), 2);
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
    for (const [index,dataset] of line.data.datasets.entries()) {
      dataset.borderWidth = (index === 0 ? 1 : 2) * scale;
      dataset.pointRadius = index === 3 ? 2 * scale : index === 0 && dotsOnly ? 1.2 * scale : 0;
      dataset.pointBorderWidth = index === 0 ? 0 : scale;
      dataset.pointHitRadius = (index === 0 ? 8 : 1) * scale;
      dataset.pointHoverRadius = 4 * scale;
    }
    line.resize(); bars.resize();
    if (redraw) { line.update('none'); bars.update('none'); }
  }
  resizePresentation();
  window.matchMedia('(width > 1400px)').addEventListener('change', () => resizePresentation());
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
      line.data.datasets[0].label = t('time');
      line.data.datasets[3].label = t('best');
      bars.data.datasets[0].label = t('solves');
      dotsOnly = plot.times.filter(time => time !== null && Number.isFinite(time)).length > 100;
      for (const index of [0,3]) {
        line.data.datasets[index].showLine = !dotsOnly;
      }
      line.data.datasets[0].pointRadius = dotsOnly ? 1.2 * scale : 0;
      // Keep charts light on mobile while statistics always use every solve.
      const stride = Math.max(1, Math.ceil(stats.times.length / 600));
      const indexes = stats.times.map((_, index) => index).filter(index => index % stride === 0 || index === stats.times.length - 1 || stats.bestProgression[index] !== null);
      solveTicks = solveCountTicks(stats.times.length);
      const axis = timeAxis([...plot.times, ...plot.rolling5, ...plot.rolling12, ...plot.bestProgression].map(value => value === null ? null : value / 1000));
      timeTicks = axis.ticks;
      line.options.scales!.y!.min = axis.min;
      line.options.scales!.y!.max = axis.max;
      line.options.scales!.x!.max = Math.max(2, stats.times.length);
      for (const [index, values] of [plot.times, plot.rolling5, plot.rolling12, plot.bestProgression].entries()) {
        line.data.datasets[index].data = indexes.map(i => ({
          x: i + 1, y: values[i] !== null && Number.isFinite(values[i]) ? values[i]! / 1000 : null,
        }));
      }
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
    clear() {
      solveTimestamps = [];
      solveTicks = []; timeTicks = []; histogramTicks = []; histogramBoundaries = []; histogramTotal = 0;
      for (const chart of [line,bars]) { for (const dataset of chart.data.datasets) dataset.data = []; chart.clear(); }
    },
  };
}
