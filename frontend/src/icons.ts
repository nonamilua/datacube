import { ChartLine, Clock3, Settings, Trash2, createElement } from 'lucide';

const icons = { timer: Clock3, analysis: ChartLine, settings: Settings, trash: Trash2 };

export function icon(name: keyof typeof icons): SVGElement {
  return createElement(icons[name], {
    width: '20',
    height: '20',
    'stroke-width': '1.75',
    'aria-hidden': 'true',
    focusable: 'false',
  });
}
