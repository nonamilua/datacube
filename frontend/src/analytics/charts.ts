import { Chart, LineController, BarController, LineElement, PointElement, BarElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';
import { drawPoint } from 'chart.js/helpers';
import { histogram, intervalPercentage, timePlot, type statistics } from './statistics';
import { solveCountTicks, timeAxis, distributionAxis } from './axes';
import { formatTime } from '../timer/timer';
import { t } from '../i18n';
Chart.register(LineController, BarController, LineElement, PointElement, BarElement, LinearScale, CategoryScale, Tooltip, Legend);

export function createCharts(lineCanvas: HTMLCanvasElement, histogramCanvas: HTMLCanvasElement) {
  const style = getComputedStyle(document.documentElement);
  const color = (name: string) => style.getPropertyValue(name).trim();
  Chart.defaults.font.family = style.getPropertyValue('--bs-body-font-family').trim();
  Chart.defaults.font.size = 10;
  Chart.defaults.color = color('--muted');
  let solveTicks: number[] = [];
  let timeTicks: number[] = [];
  let dotsOnly = false;
  // Canvas symbols preserve each marker's actual size without shortening legend lines.
  function legendPoint(pointStyle: 'circle' | 'rectRot', radius: number, fill: string, borderWidth: number) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    const context = canvas.getContext('2d')!;
    context.fillStyle = context.strokeStyle = fill;
    context.lineWidth = borderWidth;
    drawPoint(context, { pointStyle, radius, borderWidth, rotation: 0 }, 4, 4);
    return canvas;
  }
  const timeSymbol = legendPoint('circle', 1.2, color('--muted'), 0);
  const bestSymbol = legendPoint('rectRot', 2, color('--ready'), 2);
  const line = new Chart<'line', {x: number; y: number | null}[]>(lineCanvas, {
    type: 'line', data: { labels: [], datasets: [
      // DNF values are null: omit them and connect the surrounding valid times.
      { label: 'time', data: [], borderColor: color('--muted'), backgroundColor: color('--muted'), borderWidth: 1, pointBorderWidth: 0, pointRadius: 0, pointHitRadius: 8, spanGaps: true },
      { label: 'ao5', data: [], borderColor: color('--holding'), borderWidth: 2, pointRadius: 0 },
      { label: 'ao12', data: [], borderColor: color('--checkbox-bg'), borderWidth: 2, pointRadius: 0 },
      // Lower drawing order paints best points last, above overlapping time points.
      { label: 'best', data: [], borderColor: color('--ready'), backgroundColor: color('--ready'), borderWidth: 2, pointRadius: 2, pointStyle: 'rectRot', spanGaps: true, order: -1 },
    ] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: {
        boxWidth: 12, boxHeight: 8, padding: 8, usePointStyle: true,
        generateLabels: chart => Chart.defaults.plugins.legend.labels.generateLabels(chart).sort((a, b) => a.datasetIndex! - b.datasetIndex!).map(item => ({
          ...item, pointStyle: dotsOnly && item.datasetIndex === 3 ? bestSymbol : dotsOnly && item.datasetIndex === 0 ? timeSymbol : 'line',
        })),
      } }, tooltip: { callbacks: {
        label: item => `${item.dataset.label} ${formatTime(Math.round(item.parsed.y! * 1000))}`,
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
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          title: items => {
            const index = items[0]?.dataIndex;
            return index === undefined ? '' : `${histogramBoundaries[index].toFixed(1)} ⊢ ${histogramBoundaries[index + 1].toFixed(1)}`;
          },
          label: item => intervalPercentage(item.parsed.y!, histogramTotal),
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
  return {
    update(stats: ReturnType<typeof statistics>, hideOutliers = false) {
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
      line.data.datasets[0].pointRadius = dotsOnly ? 1.2 : 0;
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
    resize() { line.resize(); bars.resize(); },
  };
}
