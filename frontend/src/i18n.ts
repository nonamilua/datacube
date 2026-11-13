export type Language = 'en' | 'pt-BR' | 'es';

// English keys keep interface copy easy to find in the code.
export const translations: Record<string, readonly [string, string]> = {
  'import':['importar','importar'], 'export':['exportar','exportar'], 'about':['sobre','acerca de'],
  'export {account} solves?':['exportar os tempos de {account}?','¿exportar los tiempos de {account}?'],
  'download':['baixar','descargar'], 'export unavailable try again':['falha ao exportar tente novamente','error al exportar intenta de nuevo'],
  'datacube backup':['backup datacube','respaldo de datacube'],
  'invalid datacube backup':['backup datacube inválido','respaldo de datacube inválido'],
  'to add':['para adicionar','por añadir'], 'added':['adicionados','añadidos'],
  'to skip':['para ignorar','por omitir'],
  'duplicate IDs will be skipped':['ids duplicados serão ignorados','se omitirán los ids duplicados'],
  'import solves':['importar tempos','importar tiempos'], 'review import':['revisar importação','revisar importación'],
  'importing solves':['importando tempos','importando tiempos'], 'import complete':['importação concluída','importación completada'],
  'imported':['importados','importados'], 'skipped':['ignorados','omitidos'], 'done':['concluir','listo'],
  'existing solves are kept duplicates are skipped':['tempos existentes são mantidos duplicados são ignorados','se conservan los tiempos existentes y se omiten los duplicados'],
  'invalid import data':['dados de importação inválidos','datos de importación inválidos'],
  'import unavailable try again':['falha ao importar tente novamente','error al importar intenta de nuevo'],
  'warning':['aviso','aviso'],
  'too many requests try again shortly':['muitas tentativas tente novamente em instantes','demasiados intentos inténtalo de nuevo en unos instantes'],
  'too many requests try again in 1 second':['muitas tentativas tente novamente em 1 segundo','demasiados intentos inténtalo de nuevo en 1 segundo'],
  'too many requests try again in {seconds} seconds':['muitas tentativas tente novamente em {seconds} segundos','demasiados intentos inténtalo de nuevo en {seconds} segundos'],
  'each account can save up to {limit} solves':['cada conta pode salvar até {limit} tempos','cada cuenta puede guardar hasta {limit} tiempos'],
  'solve limit reached':['limite de tempos atingido','límite de tiempos alcanzado'],
  'delete saved solves and try the import again':['exclua tempos salvos e tente importar de novo','elimina tiempos guardados e intenta importar de nuevo'],
  'free space in history to save pending solves automatically':['libere espaço no histórico para salvar os tempos pendentes automaticamente','libera espacio en el historial para guardar automáticamente los tiempos pendientes'],
  'solve limit reached pending solves will retry when you free space in history':['limite de tempos atingido libere espaço no histórico para salvar os tempos pendentes automaticamente','límite de tiempos alcanzado libera espacio en el historial para guardar automáticamente los tiempos pendientes'],
  'cube model unavailable':['modelo indisponível','modelo no disponible'],
  'version':['versão','versión'],
  'account':['conta','cuenta'], 'file':['arquivo','archivo'],
  'logged in as':['conectado como','sesión iniciada como'],
  'username must contain 3 to 16 characters':['o usuário deve ter de 3 a 16 caracteres','el usuario debe tener de 3 a 16 caracteres'],
  'username must contain 3 to 32 characters':['o usuário deve ter de 3 a 32 caracteres','el usuario debe tener de 3 a 32 caracteres'],
  'use only letters numbers and underscores':['use apenas letras números e sublinhados','usa solo letras números y guiones bajos'],
  'password must contain 8 to 128 characters':['a senha deve ter de 8 a 128 caracteres','la contraseña debe tener de 8 a 128 caracteres'],
  'close':['fechar','cerrar'], 'back':['voltar','volver'], 'next':['avançar','siguiente'],
  'choose':['escolher','elegir'], 'choose file':['escolher arquivo','elegir archivo'], 'choose event':['escolher evento','elegir evento'],
  'configure sessions':['configurar sessões','configurar sesiones'], 'review':['revisar','revisar'],
  'session':['sessão','sesión'], 'sessions':['sessões','sesiones'],
  'select a session':['selecione uma sessão','selecciona una sesión'],
  'include in import':['incluir na importação','incluir en la importación'],
  'excluded from import':['fora da importação','fuera de la importación'],
  'choose an event for each selected session':['escolha um evento para cada sessão selecionada','elige un evento para cada sesión seleccionada'],
  'cstimer comments and scrambles are not imported':['comentários e embaralhamentos do cstimer não são importados','los comentarios y mezclas de cstimer no se importan'],
  'assignments apply to every solve in each session':['as escolhas valem para todos os tempos da sessão','las opciones se aplican a todos los tiempos de la sesión'],
  'separate mixed events in cstimer before exporting':['separe eventos diferentes no cstimer antes de exportar','separa eventos distintos en cstimer antes de exportar'],
  'preview only importing is not available yet':['apenas prévia a importação ainda não está disponível','solo vista previa la importación aún no está disponible'],
  'invalid cstimer file':['arquivo cstimer inválido','archivo cstimer inválido'],
  'invalid solve data':['dados de tempos inválidos','datos de tiempos inválidos'],
  'no solves in file':['arquivo sem tempos','archivo sin tiempos'],
  'choose a txt or json file':['escolha um arquivo txt ou json','elige un archivo txt o json'],
  'file exceeds 10 mib':['arquivo excede 10 mib','archivo supera 10 mib'],
  'too many solves':['limite de 50000 tempos excedido','límite de 50000 tiempos superado'],
  'file unavailable':['arquivo indisponível','archivo no disponible'],

  'english':['inglês','inglés'], 'portuguese':['português','portugués'], 'spanish':['espanhol','español'],
  'language':['idioma','idioma'], 'navigation':['navegação','navegación'],
  'model name':['nome do modelo','nombre del modelo'], 'cube label':['nome curto','nombre corto'], 'cube model':['modelo do cubo','modelo del cubo'], 'cube models':['modelos de cubos','modelos de cubos'],
  'choose a cube model':['selecione um modelo','selecciona un modelo'], 'cube model not recognized':['modelo não reconhecido','modelo no reconocido'],
  'cube models unavailable':['modelos indisponíveis','modelos no disponibles'], 'no cube models for this event':['sem modelos para este evento','sin modelos para este evento'],
  'timer':['cronômetro','cronómetro'], 'analysis':['análise','análisis'], 'analytics':['análise','análisis'],
  'history':['histórico','historial'], 'settings':['configurações','ajustes'],
  'filter history':['filtrar histórico','filtrar historial'], 'clear':['limpar','limpiar'],
  'loading history':['carregando histórico','cargando historial'], 'history unavailable':['histórico indisponível','historial no disponible'], 'retry':['tentar novamente','reintentar'],
  'choose your event and cube in settings':['escolha seu evento e cubo nas configurações','elige tu evento y cubo en ajustes'], 'later':['depois','después'], 'open settings':['abrir ajustes','abrir ajustes'],
  'solve history':['histórico de tempos','historial de tiempos'], 'solve timer':['cronômetro','cronómetro'],
  'event':['evento','evento'], 'cube':['cubo','cubo'], 'custom':['tag','etiqueta'], 'custom tags':['tags','etiquetas'], 'custom tag':['tag','etiqueta'],
  'hide timer':['ocultar tempo','ocultar tiempo'], 'scrambles':['embaralhamentos','mezclas'],
  'fixed tags':['tags fixas','etiquetas fijas'],
  'hide outliers':['ocultar outliers','ocultar atípicos'],
  'hide the running timer while solving':['oculta o tempo enquanto resolve o cubo','oculta el tiempo mientras resuelves el cubo'],
  'generate a scramble before each solve':['gera um embaralhamento antes de cada tentativa','genera una mezcla antes de cada intento'],
  'reuse the last tag for new solves in the same event':['repete a última tag nos próximos tempos do mesmo evento','reutiliza la última etiqueta en nuevos tiempos del mismo evento'],
  'hide unusually slow solves only in the times chart':['oculta tempos muito altos apenas no gráfico de tempos','oculta tiempos inusualmente altos solo en el gráfico de tiempos'],
  'overview':['visão geral','resumen'], 'compare':['comparar','comparar'],
  'cubes':['cubos','cubos'], 'selected':['selecionados','seleccionados'], 'selected short':['selec.','selec.'],
  'cube comparison':['comparação de cubos','comparación de cubos'], 'custom comparison':['comparação de tags','comparación de etiquetas'],
  'cubes comparison':['comparação de cubos','comparación de cubos'], 'tag comparison':['comparação de tags','comparación de etiquetas'], 'tag':['tag','etiqueta'],
  'valid solves':['tempos válidos','tiempos válidos'], 'no valid times':['sem tempos válidos','sin tiempos válidos'],
  'quartiles':['quartis','cuartiles'], 'whiskers':['limites','extremos'], 'small sample':['amostra pequena','muestra pequeña'],
  'lower quartile':['quartil inferior','cuartil inferior'], 'upper quartile':['quartil superior','cuartil superior'],
  'lower whisker':['limite inferior','extremo inferior'], 'upper whisker':['limite superior','extremo superior'],
  'analytics view':['visualização','vista'], 'custom dates':['datas personalizadas','fechas personalizadas'],
  'compare not available yet':['comparação ainda indisponível','comparación aún no disponible'],
  'sign out':['sair','salir'], 'cancel':['cancelar','cancelar'], 'sign in':['entrar','iniciar sesión'], 'create account':['criar conta','crear cuenta'],
  'username':['usuário','usuario'], 'password':['senha','contraseña'],
  'no solves yet':['sem tempos','sin tiempos'], 'no solves':['sem tempos','sin tiempos'],
  'no completed times':['sem tempos válidos','sin tiempos válidos'],
  'range':['período','período'], 'custom range':['personalizado','personalizado'], 'all time':['todo o período','todo el período'],
  'last 2 hours':['últimas 2 horas','últimas 2 horas'], 'last 4 hours':['últimas 4 horas','últimas 4 horas'],
  'today':['hoje','hoy'], 'last 7 days':['últimos 7 dias','últimos 7 días'], 'last 30 days':['últimos 30 dias','últimos 30 días'],
  'from':['de','desde'], 'to':['até','hasta'], 'all':['todos','todos'],
  'none':['nenhuma','ninguna'], 'solve count':['total','tiempos'],
  'middle 50%':['50% centrais','50% central'], 'best–worst':['melhor–pior','mejor–peor'],
  'solves':['tempos','tiempos'], 'solve':['tempo','tiempo'], 'mean':['média','media'], 'median':['mediana','mediana'],
  'std dev':['desvio','desviación'], '+2 count':['total +2','total +2'], 'count':['total','total'],
  'best':['melhor','mejor'], 'worst':['pior','peor'], 'fav event':['evento favorito','evento favorito'],
  'best cube':['melhor cubo','mejor cubo'], 'best custom':['melhor tag','mejor etiqueta'],
  'best ao5':['melhor ao5','mejor ao5'], 'best ao12':['melhor ao12','mejor ao12'],
  'best ao50':['melhor ao50','mejor ao50'], 'best ao100':['melhor ao100','mejor ao100'],
  'times':['tempos','tiempos'], 'time':['tempo','tiempo'], 'distribution':['distribuição','distribución'],
  'outlier':['atípico','atípico'], 'outliers':['atípicos','atípicos'],
  'solve time histogram':['histograma de tempos','histograma de tiempos'],
  'solve times rolling averages and best progression':['tempos médias móveis e evolução do melhor','tiempos medias móviles y evolución del mejor'],
  'outliers hidden':['atípicos ocultos','atípicos ocultos'],
  'show best statistics':['mostrar melhores estatísticas','mostrar mejores estadísticas'],
  'show overall activity':['mostrar atividade geral','mostrar actividad general'],
  'activity · overall':['atividade · geral','actividad · general'],
  'overall solve activity':['atividade geral de tempos','actividad general de tiempos'],
  'show current statistics':['mostrar estatísticas atuais','mostrar estadísticas actuales'],
  'new scramble':['novo embaralhamento','nueva mezcla'], 'view scramble':['ver embaralhamento','ver mezcla'],
  'saved scramble':['embaralhamento salvo','mezcla guardada'], 'edit solve':['editar tempo','editar tiempo'],
  'delete solve':['excluir tempo','eliminar tiempo'],
  'loading scramble':['gerando embaralhamento','generando mezcla'],
  'scramble failed try again':['falha ao gerar tente novamente','error al generar intenta de nuevo'],
  'hold to start':['segure para iniciar','mantén para iniciar'], 'hold':['segure','mantén'],
  'release':['solte','suelta'], 'release to start':['solte para iniciar','suelta para iniciar'],
  'any key to stop':['qualquer tecla para parar','cualquier tecla para parar'],
  'hold then release to start press to stop':['segure e solte para iniciar pressione para parar','mantén y suelta para iniciar pulsa para parar'],
  'cannot exceed 12 characters':['máximo de 12 caracteres','máximo de 12 caracteres'], 'use plain text':['use texto simples','usa texto simple'],
  'choose a later end date':['escolha uma data final posterior','elige una fecha final posterior'], 'check dates':['confira as datas','revisa las fechas'],
  'saving':['salvando','guardando'], 'solve updated':['tempo atualizado','tiempo actualizado'], 'solve deleted':['tempo excluído','tiempo eliminado'],
  'connection unavailable':['conexão indisponível','conexión no disponible'], 'storage unavailable':['armazenamento indisponível','almacenamiento no disponible'],
  'settings unavailable':['configurações indisponíveis','ajustes no disponibles'], 'sign out unavailable':['não foi possível sair','no se pudo salir'],
  'save unavailable':['não foi possível salvar','no se pudo guardar'], 'delete unavailable':['não foi possível excluir','no se pudo eliminar'],
  'could not connect try again':['falha na conexão tente novamente','error de conexión intenta de nuevo'],
  'could not save try again':['falha ao salvar tente novamente','error al guardar intenta de nuevo'],
  'sign in again':['entre novamente','inicia sesión de nuevo'], 'solve no longer exists':['tempo não encontrado','tiempo no encontrado'],
  'edit rejected refresh and try again':['atualize e tente novamente','actualiza e intenta de nuevo'],
  'check your details':['confira seus dados','revisa tus datos'], 'username unavailable':['usuário indisponível','usuario no disponible'],
  'invalid credentials':['dados inválidos','datos incorrectos'], 'account changed sign in again':['conta alterada entre novamente','cuenta cambiada inicia sesión de nuevo'],
  'loading security check':['carregando verificação de segurança','cargando verificación de seguridad'],
  'complete the security check':['conclua a verificação de segurança','completa la verificación de seguridad'],
  'security check rejected try again':['verificação de segurança recusada tente novamente','verificación de seguridad rechazada inténtalo de nuevo'],
  'security check expired or already used try again':['verificação de segurança expirada ou já usada tente novamente','verificación de seguridad vencida o ya usada inténtalo de nuevo'],
  'security check unavailable try again':['verificação de segurança indisponível tente novamente','verificación de seguridad no disponible inténtalo de nuevo'],
};

let language: Language = 'en';
const listeners = new Set<() => void>();
export function normalizeLanguage(value: unknown): Language { return value === 'pt-BR' || value === 'es' ? value : 'en'; }
export function currentLanguage(): Language { return language; }
export const settingsKey = (accountId: number): string => `namicubes settings ${accountId}`;
export function languageForAccount(storage: Pick<Storage, 'getItem'>, accountId: number): Language {
  try { return normalizeLanguage(JSON.parse(storage.getItem(settingsKey(accountId)) ?? '{}').language); }
  catch { return 'en'; }
}
export function rememberLanguage(storage: Pick<Storage, 'getItem' | 'setItem'>, accountId: number, value: unknown): void {
  let settings;
  try { settings = JSON.parse(storage.getItem(settingsKey(accountId)) ?? '{}'); } catch { settings = {}; }
  storage.setItem(settingsKey(accountId),JSON.stringify({...settings,language:normalizeLanguage(value)}));
}
export function t(key: string): string { return language === 'en' ? (key === 'custom range' ? 'custom' : key === 'solve count' ? 'solves' : key) : translations[key]?.[language === 'pt-BR' ? 0 : 1] ?? key; }
export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setLanguage(value: unknown): void {
  const next = normalizeLanguage(value);
  if (next === language) return;
  language = next;
  for (const listener of listeners) listener();
}
export function setText(element: HTMLElement, key: string): void {
  element.dataset.i18n = key;
  element.textContent = t(key);
}
export function setActionLabel(element: HTMLElement, key: string, suffix = ''): void {
  element.dataset.i18nAction = key;
  element.dataset.i18nSuffix = suffix;
  element.title = t(key);
  element.setAttribute('aria-label', `${t(key)}${suffix}`);
}

// Capture only original interface copy before user data is inserted.
// Translating those text nodes preserves child inputs and SVG icons.
export function initializeTranslations(root: Document = document): void {
  const texts: {node: Text; key: string; before: string; after: string}[] = [];
  const attributes: {element: Element; name: string; key: string}[] = [];
  const walker = root.createTreeWalker(root.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const key = node.data.trim();
    if (translations[key] && !node.parentElement?.closest('script, style, .brand-wordmark')) {
      const match = node.data.match(/^(\s*)(.*?)(\s*)$/s)!;
      texts.push({node,key,before:match[1],after:match[3]});
    }
  }
  for (const element of Array.from(root.querySelectorAll('[aria-label], [title]'))) {
    for (const name of ['aria-label','title']) {
      const key = element.getAttribute(name);
      if (key && translations[key]) attributes.push({element,name,key});
    }
  }
  const apply = () => {
    root.documentElement.lang = language;
    const brand = root.querySelector<HTMLElement>('.brand');
    if (brand) {
      const portuguese = language === 'pt-BR';
      brand.querySelector<HTMLElement>('.brand-top')!.textContent = portuguese ? 'dados' : 'data';
      brand.querySelector<HTMLElement>('.brand-bottom')!.textContent = portuguese ? 'cubos' : 'cube';
      brand.querySelector<HTMLElement>('.brand-ampersand')!.hidden = !portuguese;
      brand.setAttribute('aria-label',portuguese ? 'dados e cubos' : 'datacube');
      root.title = portuguese ? 'dados&cubos' : 'datacube';
    }
    for (const {node,key,before,after} of texts) if (node.isConnected) node.data = before + t(key) + after;
    for (const {element,name,key} of attributes) element.setAttribute(name,t(key));
    for (const element of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n]'))) element.textContent = t(element.dataset.i18n!);
    for (const element of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n-action]'))) setActionLabel(element,element.dataset.i18nAction!,element.dataset.i18nSuffix);
  };
  onLanguageChange(apply);
  apply();
}
