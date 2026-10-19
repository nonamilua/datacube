import { ChartLine, ChevronRight, Clock3, Dice5, History, Pencil, Settings, Shuffle, Trash2, FileInput, FileOutput, Info, SlidersHorizontal, X, createElement } from 'lucide';

const icons = { timer: Clock3, analysis: ChartLine, history: History, settings: Settings, trash: Trash2, edit: Pencil, next: ChevronRight, scramble:Dice5, shuffle:Shuffle, import:FileInput, export:FileOutput, about:Info, filter:SlidersHorizontal, clear:X };

export function icon(name: keyof typeof icons): SVGElement {
  return createElement(icons[name], {
    width: '20',
    height: '20',
    'stroke-width': '1.75',
    'aria-hidden': 'true',
    focusable: 'false',
  });
}
