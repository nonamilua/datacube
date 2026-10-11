import type { Language } from '../i18n.ts';

// Closed mobile controls use compact copy; native option lists retain full labels.
const labels: Record<Language, Record<string,string>> = {
  en: {'':'all time','2h':'last 2 hours','4h':'last 4 hours','1':'today','7':'last 7 days','30':'last 30 days','custom':'custom'},
  'pt-BR': {'':'tudo','2h':'últ. 2 horas','4h':'últ. 4 horas','1':'hoje','7':'últ. 7 dias','30':'últ. 30 dias','custom':'personalizado'},
  es: {'':'todo','2h':'últ. 2 horas','4h':'últ. 4 horas','1':'hoy','7':'últ. 7 días','30':'últ. 30 días','custom':'personalizado'},
};
export function shortRangeLabel(value: string, language: Language): string { return labels[language][value] ?? ''; }
