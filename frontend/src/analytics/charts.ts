import { Chart, LineController, BarController, LineElement, PointElement, BarElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';
import { histogram, type statistics } from './statistics';
import { solveCountTicks } from './axes';
Chart.register(LineController, BarController, LineElement, PointElement, BarElement, LinearScale, CategoryScale, Tooltip, Legend);

export function createCharts(lineCanvas: HTMLCanvasElement, histogramCanvas: HTMLCanvasElement) {
  const style = getComputedStyle(document.documentElement);
  const color = (name: string) => style.getPropertyValue(name).trim();
  Chart.defaults.font.family = style.getPropertyValue('--bs-body-font-family').trim();
  Chart.defaults.font.size = 10;
  Chart.defaults.color = color('--muted');
  let solveTicks: number[] = [];
  const line = new Chart<'line', {x: number; y: number | null}[]>(lineCanvas, {
    type: 'line', data: { labels: [], datasets: [
      // DNF values are null: omit them and connect the surrounding valid times.
      { label: 'time', data: [], borderColor: color('--muted'), borderWidth: 1, pointRadius: 0, pointHitRadius: 8, spanGaps: true },
      { label: 'ao5', data: [], borderColor: color('--holding'), borderWidth: 2, pointRadius: 0 },
      { label: 'ao12', data: [], borderColor: color('--checkbox-bg'), borderWidth: 2, pointRadius: 0 },
      { label: 'best', data: [], borderColor: color('--ready'), borderWidth: 2, pointRadius: 2, spanGaps: true },
    ] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 2, padding: 8 } } },
      scales: {
        x: { type: 'linear', min: 1, max: 2, grid: { display: false },
          afterBuildTicks: scale => { scale.ticks = solveTicks.map(value => ({value})); },
          ticks: { autoSkip: false, minRotation: 0, maxRotation: 0, precision: 0 },
        },
        y: { grid: { color: color('--list-border') }, ticks: { maxTicksLimit: 5 } },
      },
    },
  });
  let histogramBoundaries: number[] = [];
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
          label: item => `${item.parsed.y} solves`,
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
        y: { beginAtZero: true, grid: { color: color('--list-border') }, ticks: { precision: 0, maxTicksLimit: 5 } },
      },
    },
  });
  return {
    update(stats: ReturnType<typeof statistics>) {
      // Keep charts light on mobile while statistics always use every solve.
      const stride = Math.max(1, Math.ceil(stats.times.length / 600));
      const indexes = stats.times.map((_, index) => index).filter(index => index % stride === 0 || index === stats.times.length - 1 || stats.bestProgression[index] !== null);
      solveTicks = solveCountTicks(stats.times.length);
      line.options.scales!.x!.max = Math.max(2, stats.times.length);
      for (const [index, values] of [stats.times, stats.rolling5, stats.rolling12, stats.bestProgression].entries()) {
        line.data.datasets[index].data = indexes.map(i => ({
          x: i + 1, y: values[i] !== null && Number.isFinite(values[i]) ? values[i]! / 1000 : null,
        }));
      }
      const distribution = histogram(stats.times);
      const omitted = document.getElementById('histogram-outliers')!;
      omitted.hidden = distribution.omitted === 0;
      omitted.textContent = `${distribution.omitted} ${distribution.omitted === 1 ? 'outlier' : 'outliers'}`;
      histogramCanvas.setAttribute('aria-label', `solve time histogram ${distribution.omitted} outliers hidden`);
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
