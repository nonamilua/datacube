import { Chart, BarController, BarElement, LinearScale, CategoryScale, type Plugin } from 'chart.js';
import type { ComparisonGroup } from './boxplots';
import { comparisonColors } from './compare-colors';
import { timeAxis } from './axes';
import { t } from '../i18n';
import { hitsBox, type BoxBounds } from './box-hit';
Chart.register(BarController,BarElement,LinearScale,CategoryScale);

let activeTooltip: {canvas:HTMLCanvasElement; close:()=>void} | null = null;
export function dismissCompareTooltip() { activeTooltip?.close(); }
document.addEventListener('keydown',event => { if (event.key === 'Escape') dismissCompareTooltip(); });
document.addEventListener('pointerdown',event => {
  if (activeTooltip && event.target !== activeTooltip.canvas) dismissCompareTooltip();
});

export function createBoxplotChart(root: HTMLElement) {
  const scroll = root.querySelector<HTMLElement>('.compare-scroll')!;
  const content = root.querySelector<HTMLElement>('.compare-canvas')!;
  const canvas = content.querySelector('canvas')!;
  const axisArea = root.querySelector<HTMLElement>('.compare-axis')!;
  const axisCanvas = axisArea.querySelector('canvas')!;
  const empty = root.querySelector<HTMLElement>('.compare-empty')!;
  const style = getComputedStyle(document.documentElement);
  const color = (name:string) => style.getPropertyValue(name).trim();
  const font = style.getPropertyValue('--bs-body-font-family').trim();
  let groups: ComparisonGroup[] = [];
  let rowColors: string[] = [];
  let tickValues: number[] = [0,1];
  let rowHeight = 52;
  let narrow = window.innerWidth < 768;
  const tooltip = document.createElement('div');
  tooltip.className = 'compare-tooltip'; tooltip.setAttribute('role','tooltip'); tooltip.hidden = true;
  root.append(tooltip);
  let tooltipIndex = -1, pinned = false;
  function closeTooltip() {
    tooltip.hidden = true; tooltipIndex = -1; pinned = false;
    if (activeTooltip?.canvas === canvas) activeTooltip = null;
  }
  const axis = new Chart(axisCanvas,{
    type:'bar',data:{datasets:[]},options:{responsive:true,maintainAspectRatio:false,animation:false,events:[],
      layout:{padding:{left:0,right:0}},plugins:{legend:{display:false},tooltip:{enabled:false}},
      scales:{x:{type:'linear',min:0,max:1,grid:{display:false},border:{color:color('--panel-border')},
        afterBuildTicks:scale => { scale.ticks = tickValues.map(value => ({value})); },
        // This canvas contains only an axis; mobile needs no empty plot above it.
        afterFit:scale => { if (narrow) scale.height = scale.chart.height; },
        ticks:{autoSkip:false,maxRotation:0,minRotation:0,color:color('--muted'),font:{family:font,size:9}}},y:{display:false}},
    },
  });
  const plugin: Plugin<'bar'> = {id:'comparison-boxes',afterDraw(chart) {
    if (!axis.scales.x) return;
    const {ctx} = chart;
    const x = (value:number) => axis.scales.x.getPixelForValue(value / 1000);
    ctx.save();
    for (const tick of tickValues) {
      const pixel = axis.scales.x.getPixelForValue(tick);
      ctx.strokeStyle = color('--list-border'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pixel,0); ctx.lineTo(pixel,chart.height); ctx.stroke();
    }
    groups.forEach((group,index) => {
      const top = index * rowHeight;
      const y = top + (narrow ? 25 : rowHeight / 2);
      ctx.font = `10px ${font}`; ctx.fillStyle = color('--muted');
      let name = group.name;
      const width = narrow ? chart.width - 12 : 112;
      while (ctx.measureText(name).width > width && name.length > 1) name = name.slice(0,-1);
      if (name !== group.name) name = name.slice(0,-1) + '…';
      ctx.fillText(name,4,narrow ? top + 11 : y + 3);
      const box = group.box;
      if (!box) { ctx.fillText(t('no valid times'),narrow ? 4 : 124,y + 4); return; }
      const left = x(box.q1), right = x(box.q3);
      ctx.strokeStyle = color('--muted'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x(box.low),y); ctx.lineTo(x(box.high),y);
      for (const value of [box.low,box.high]) { ctx.moveTo(x(value),y-5); ctx.lineTo(x(value),y+5); }
      ctx.stroke();
      ctx.fillStyle = rowColors[index]; ctx.fillRect(left,y-8,Math.max(1,right-left),16);
      ctx.strokeStyle = color('--bs-body-color'); ctx.strokeRect(left,y-8,Math.max(1,right-left),16);
      ctx.strokeStyle = color(box.q1 === box.q3 ? '--bs-body-color' : '--bs-body-bg'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x(box.median),y-8); ctx.lineTo(x(box.median),y+8); ctx.stroke();
      ctx.fillStyle = color('--bs-body-color');
      for (const value of box.outliers) { ctx.beginPath(); ctx.arc(x(value),y,1.5,0,Math.PI*2); ctx.fill(); }
    });
    ctx.restore();
  }};
  const chart = new Chart(canvas, {type:'bar',data:{datasets:[]},plugins:[plugin],
    options:{responsive:true,maintainAspectRatio:false,animation:false,events:[],
      plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false}},
    },
  });
  const resizeObserver = new ResizeObserver(() => resize());
  function bounds(index:number):BoxBounds {
    const box = groups[index].box!;
    const y = index * rowHeight + (narrow ? 25 : rowHeight / 2);
    const left = axis.scales.x.getPixelForValue(box.q1 / 1000);
    return {left,right:Math.max(left + 1,axis.scales.x.getPixelForValue(box.q3 / 1000)),top:y-8,bottom:y+8};
  }
  function hit(event:MouseEvent):number {
    const rect = canvas.getBoundingClientRect();
    const viewport = scroll.getBoundingClientRect();
    if (event.clientY < viewport.top || event.clientY > viewport.bottom || !rect.width || !rect.height) return -1;
    const x = (event.clientX - rect.left) * chart.width / rect.width;
    const y = (event.clientY - rect.top) * chart.height / rect.height;
    return groups.findIndex((group,index) => group.box && hitsBox(bounds(index),x,y));
  }
  function openTooltip(index:number, pin:boolean) {
    if (activeTooltip?.canvas !== canvas) dismissCompareTooltip();
    activeTooltip = {canvas,close:closeTooltip}; tooltipIndex = index; pinned = pin;
    const box = groups[index].box!;
    tooltip.replaceChildren(...[`${t('median')} ${(box.median / 1000).toFixed(2)}`,`${t('count')} ${box.count}`].map(text => {
      const line = document.createElement('div'); line.textContent = text; return line;
    }));
    tooltip.hidden = false;
    const area = root.getBoundingClientRect(), rect = canvas.getBoundingClientRect(), boxBounds = bounds(index);
    const left = rect.left - area.left + boxBounds.left * rect.width / chart.width;
    const top = rect.top - area.top + boxBounds.top * rect.height / chart.height;
    let y = top - tooltip.offsetHeight - 4;
    if (y < 4) y = top + 16 + 4;
    tooltip.style.left = `${Math.max(4,Math.min(left,root.clientWidth - tooltip.offsetWidth - 4))}px`;
    tooltip.style.top = `${Math.max(4,Math.min(y,root.clientHeight - tooltip.offsetHeight - 4))}px`;
  }
  canvas.addEventListener('pointermove',event => {
    if (event.pointerType === 'touch' || pinned) return;
    const index = hit(event);
    if (index < 0) closeTooltip(); else openTooltip(index,false);
  });
  canvas.addEventListener('pointerleave',() => { if (!pinned) closeTooltip(); });
  canvas.addEventListener('click',event => {
    const index = hit(event);
    if (index < 0 || (index === tooltipIndex && pinned)) closeTooltip();
    else openTooltip(index,true);
  });
  scroll.addEventListener('scroll',dismissCompareTooltip,{passive:true});
  resizeObserver.observe(scroll);
  function resize() {
    dismissCompareTooltip();
    narrow = window.innerWidth < 768;
    rowHeight = narrow ? 40 : 44;
    content.style.height = `${Math.max(1,groups.length) * rowHeight}px`;
    axisArea.style.width = `${content.clientWidth}px`;
    axis.options.layout!.padding = {left:narrow ? 0 : 120,right:0};
    axis.options.scales!.x!.ticks!.padding = narrow ? 1 : 3;
    axis.options.scales!.x!.grid!.tickLength = narrow ? 4 : 8;
    axis.resize(); axis.update('none'); chart.resize(); chart.draw();
  }
  return {
    update(next:ComparisonGroup[], invalid:boolean) {
      dismissCompareTooltip();
      groups = next;
      canvas.setAttribute('aria-label',`${t(root.id === 'cube-boxplot' ? 'cube comparison' : 'tag comparison')} ${groups.map(group => group.name).join(' ')}`);
      const palette = comparisonColors(groups.filter(group => group.box).length,color('--compare-cyan'),color('--compare-violet'),color('--compare-pink'));
      let colorIndex = 0;
      // DNF-only rows have no box and do not consume a color in the sequence.
      rowColors = groups.map(group => group.box ? palette[colorIndex++] : color('--muted'));
      empty.hidden = groups.length > 0 && !invalid;
      empty.textContent = t(invalid ? 'check dates' : 'no solves');
      scroll.hidden = axisArea.hidden = !empty.hidden;
      const values = groups.flatMap(group => group.box ? [group.box.low,group.box.high,...group.box.outliers] : []).map(value => value/1000);
      const bounds = timeAxis(values); tickValues = bounds.ticks;
      axis.options.scales!.x!.min = bounds.min; axis.options.scales!.x!.max = bounds.max;
      resize();
    },
    resize,
    clear() { dismissCompareTooltip(); groups = []; canvas.setAttribute('aria-label',t(root.id === 'cube-boxplot' ? 'cube comparison' : 'tag comparison')); chart.clear(); },
  };
}
