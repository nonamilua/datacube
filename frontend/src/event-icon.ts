export function setupEventIcon(select:HTMLSelectElement, icon:HTMLElement, selectedEvent:() => string) {
  let events:Record<string,{reference:string}> = {};
  function update() {
    const path = events[selectedEvent()]?.reference;
    icon.hidden = !path;
    if (path) icon.style.setProperty('--event-icon-image',`url("${path}")`);
    else icon.style.removeProperty('--event-icon-image');
  }
  select.addEventListener('change',update);
  void fetch('/event-icons/manifest.json').then(response => {
    if (!response.ok) throw new Error('event icons unavailable');
    return response.json();
  }).then(manifest => { events = manifest.events; update(); }).catch(() => { icon.hidden = true; });
  return {update};
}
