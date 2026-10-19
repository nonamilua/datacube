import type { Organization, StoredSolve } from '../api/api';
import type { Filters } from './filters';
import { comparisonData } from './boxplots';
import { createBoxplotChart, dismissCompareTooltip } from './boxplot-chart';
import { currentLanguage, t } from '../i18n';
import { reconcileSelection, type CompareSelection } from './compare-selection';

export function setupCompareView(changed: () => void, isVisible: () => boolean) {
  const panel = document.getElementById('compare-charts')!;
  let selectedCubes: CompareSelection = null, selectedCustom: CompareSelection = null;
  let cubeChart: ReturnType<typeof createBoxplotChart> | null = null;
  let customChart: ReturnType<typeof createBoxplotChart> | null = null;
  function selectionControl(field:'cube'|'custom') {
    const button = document.getElementById(`compare-${field}`) as HTMLButtonElement;
    const popup = document.getElementById(`compare-${field}-popup`) as HTMLDialogElement;
    const list = popup.querySelector<HTMLElement>('.compare-options')!;
    const all = popup.querySelector<HTMLInputElement>('.compare-all input')!;
    const allLabel = popup.querySelector<HTMLElement>('.compare-all span')!;
    let available: string[] = [];
    let optionsKey = '';
    const selected = () => field === 'cube' ? selectedCubes : selectedCustom;
    function refreshLabel() {
      const selection = selected();
      const count = selection === null ? available.length : selection.length;
      const everything = available.length > 0 && count === available.length;
      const compact = window.innerWidth < 768 && currentLanguage() !== 'en';
      button.textContent = everything ? t('all') : `${count} ${t(compact ? 'selected short' : 'selected')}`;
      button.setAttribute('aria-label',`${t(field === 'cube' ? 'cubes' : 'custom tags')} ${everything ? t('all') : `${count} ${t('selected')}`}`);
    }
    function close() { if (popup.open) popup.close(); }
    button.addEventListener('click',() => {
      const rect = button.getBoundingClientRect();
      const top = rect.bottom + 4;
      popup.style.width = `${rect.width}px`;
      popup.style.top = `${top}px`;
      popup.style.left = `${rect.left}px`;
      popup.style.maxHeight = `${Math.max(44,window.innerHeight - top - 16)}px`;
      popup.showModal(); button.setAttribute('aria-expanded','true');
    });
    popup.addEventListener('click',event => {
      const rect = popup.getBoundingClientRect();
      if (event.target === popup && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
    });
    popup.addEventListener('close',() => { button.setAttribute('aria-expanded','false'); if (!button.closest('[hidden]')) button.focus({preventScroll:true}); });
    all.addEventListener('change',() => {
      if (field === 'cube') selectedCubes = all.checked ? null : []; else selectedCustom = all.checked ? null : [];
      changed();
    });
    return {
      close,
      refreshLabel,
      update(options:{value:string;name:string}[]) {
        available = options.map(option => option.value);
        const selection = selected();
        const count = selection === null ? available.length : selection.length;
        refreshLabel();
        allLabel.textContent = t('all');
        all.checked = available.length > 0 && count === available.length;
        all.indeterminate = count > 0 && count < available.length;
        all.disabled = !available.length;
        const key = JSON.stringify(options);
        if (key !== optionsKey) {
          optionsKey = key;
          list.replaceChildren(...options.map(option => {
            const label = document.createElement('label');
            const input = document.createElement('input'); input.type = 'checkbox'; input.value = option.value;
            const name = document.createElement('span'); name.textContent = option.name; name.title = option.name;
            input.addEventListener('change',() => {
              const values = (selected() ?? available).filter(value => value !== option.value);
              if (input.checked) values.push(option.value);
              const next = reconcileSelection(values,available);
              if (field === 'cube') selectedCubes = next; else selectedCustom = next;
              changed();
            });
            label.append(input,name); return label;
          }));
        }
        for (const input of Array.from(list.querySelectorAll<HTMLInputElement>('input'))) input.checked = selection === null || selection.includes(input.value);
        button.disabled = options.length === 0;
      },
    };
  }
  const cube = selectionControl('cube'), custom = selectionControl('custom');
  window.addEventListener('resize',() => { cube.close(); custom.close(); cube.refreshLabel(); custom.refreshLabel(); });
  return {
    update(solves:StoredSolve[], organization:Organization, filters:Filters, now = new Date()) {
      const data = comparisonData(solves,organization,filters,selectedCubes,selectedCustom,now);
      selectedCubes = data.cubeSelection; selectedCustom = data.customSelection;
      cube.update(data.cubes); custom.update(data.custom);
      const invalid = Boolean(filters.start && filters.end && filters.start > filters.end);
      cubeChart ??= createBoxplotChart(document.getElementById('cube-boxplot')!,isVisible);
      customChart ??= createBoxplotChart(document.getElementById('custom-boxplot')!,isVisible);
      cubeChart.update(data.cubeGroups,invalid,data.cubeTotal); customChart.update(data.customGroups,invalid,data.customTotal);
    },
    show(visible:boolean) {
      dismissCompareTooltip();
      panel.hidden = !visible;
      for (const field of ['cube','custom']) {
        document.getElementById(`compare-${field}-field`)!.hidden = !visible;
        document.getElementById(`filter-${field}`)!.closest<HTMLElement>('label')!.hidden = visible;
      }
      if (!visible) { cube.close(); custom.close(); }
    },
    resize() { cubeChart?.resize(); customChart?.resize(); },
    close() { dismissCompareTooltip(); cube.close(); custom.close(); },
    reset() { selectedCubes = null; selectedCustom = null; cube.close(); custom.close(); cube.update([]); custom.update([]); cubeChart?.clear(); customChart?.clear(); this.show(false); },
  };
}
