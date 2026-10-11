import { request } from './api/api.ts';
import { setText, onLanguageChange } from './i18n.ts';

export interface CubeModel { id: string; brand: string; name: string; label: string; aliases: string[] }

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function suggestModels(models: CubeModel[], query: string): CubeModel[] {
  const text = normalize(query);
  if (!text) return [];
  const compact = text.replaceAll(' ', '');
  return models.map(model => {
    const terms = [model.label, model.name, ...model.aliases].map(normalize);
    const exact = terms.some(term => term === text || term.replaceAll(' ', '') === compact);
    const prefix = terms.some(term => term.startsWith(text) || term.replaceAll(' ', '').startsWith(compact));
    const contains = terms.some(term => text.split(' ').every(token => term.includes(token)));
    return {model, rank:exact ? 0 : prefix ? 1 : contains ? 2 : 3};
  }).filter(item => item.rank < 3).sort((a,b) => a.rank - b.rank || a.model.label.localeCompare(b.model.label)).slice(0,8).map(item => item.model);
}

export class CubeSelector {
  modelId: string | null = null;
  private models: CubeModel[] = [];
  private revision = 0;
  private active = -1;
  private suggestions: CubeModel[] = [];
  private status = 'choose a cube model';
  private handle: HTMLInputElement;
  private model: HTMLOutputElement;
  private list: HTMLElement;
  private warning: HTMLElement;

  constructor(handle: HTMLInputElement, model: HTMLOutputElement, list: HTMLElement, warning: HTMLElement) {
    this.handle = handle; this.model = model; this.list = list; this.warning = warning;
    handle.addEventListener('input', () => { this.clear(); this.showSuggestions(); });
    handle.addEventListener('focus', () => this.showSuggestions());
    handle.addEventListener('keydown', event => {
      if (event.key === 'Escape') { this.close(); event.stopPropagation(); }
      else if (!list.hidden && ['ArrowDown','ArrowUp'].includes(event.key)) {
        event.preventDefault();
        this.active = this.active < 0 ? (event.key === 'ArrowDown' ? 0 : this.suggestions.length - 1) : (this.active + (event.key === 'ArrowDown' ? 1 : -1) + this.suggestions.length) % this.suggestions.length;
        this.renderActive();
      } else if (event.key === 'Enter' && !list.hidden && this.active >= 0) {
        event.preventDefault(); this.select(this.suggestions[this.active]);
      } else if (event.key === 'Tab') this.close();
    });
    handle.addEventListener('blur', event => {
      if (!(event.relatedTarget instanceof Node && list.contains(event.relatedTarget))) this.close();
    });
    document.addEventListener('click', event => {
      if (event.target instanceof Node && event.target !== handle && !list.contains(event.target)) this.close();
    });
    onLanguageChange(() => this.renderWarning());
    this.renderWarning();
  }

  async configure(event: string, selectedId: string | null = null): Promise<void> {
    const revision = ++this.revision;
    const savedHandle = this.handle.value;
    this.models = []; this.clear();
    if (!event) return;
    try {
      const models = await request<CubeModel[]>(`/api/cube-models?event=${encodeURIComponent(event)}`);
      if (revision !== this.revision) return;
      this.models = models;
      this.status = models.length ? 'choose a cube model' : 'no cube models for this event';
      // Restore only an explicitly selected ID, never infer identity from an alias.
      const selected = this.handle.value === savedHandle ? models.find(model => model.id === selectedId) : undefined;
      if (selected) { this.modelId = selected.id; this.model.value = selected.label; }
      this.renderWarning();
      if (document.activeElement === this.handle) this.showSuggestions();
    } catch {
      if (revision !== this.revision) return;
      this.status = 'cube models unavailable'; this.renderWarning();
    }
  }

  clear(): void {
    this.modelId = null; this.model.value = ''; this.close(); this.renderWarning();
  }
  close(): void { this.list.hidden = true; this.active = -1; this.handle.setAttribute('aria-expanded','false'); this.handle.removeAttribute('aria-activedescendant'); }
  private renderWarning(): void {
    this.model.hidden = this.modelId === null;
    this.warning.hidden = this.modelId !== null;
    setText(this.warning,this.status === 'choose a cube model' && this.handle.value.trim() ? 'cube model not recognized' : this.status);
  }
  private select(model: CubeModel): void {
    this.modelId = model.id; this.model.value = model.label; this.handle.value = model.aliases[0];
    this.handle.setAttribute('aria-invalid','false');
    document.getElementById('cube-validation')!.hidden = true;
    this.close(); this.renderWarning(); this.handle.focus({preventScroll:true}); this.close();
  }
  private renderActive(): void {
    Array.from(this.list.children).forEach((child,index) => child.setAttribute('aria-selected',String(index === this.active)));
    this.handle.setAttribute('aria-activedescendant', `cube-suggestion-${this.active}`);
    this.list.children[this.active]?.scrollIntoView({block:'nearest'});
  }
  private showSuggestions(): void {
    this.close();
    if (this.modelId || this.handle.disabled) return;
    this.suggestions = suggestModels(this.models,this.handle.value);
    this.list.replaceChildren(...this.suggestions.map((model,index) => {
      const button = document.createElement('button'); button.type = 'button'; button.role = 'option';
      button.id = `cube-suggestion-${index}`; button.setAttribute('aria-selected','false'); button.textContent = model.label;
      button.addEventListener('pointerdown', event => event.preventDefault());
      button.addEventListener('click', () => this.select(model));
      return button;
    }));
    this.list.hidden = !this.suggestions.length; this.handle.setAttribute('aria-expanded',String(!this.list.hidden));
  }
}
