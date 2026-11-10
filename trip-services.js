(() => {
  'use strict';
  let geocodeQueue = Promise.resolve(), lastGeocode = 0;
  const cache = new Map();
  async function json(url, {signal, timeout = 12000, label = 'Servizio'} = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, {once:true});
    let expired = false;
    const timer = setTimeout(() => {expired = true; controller.abort();}, timeout);
    try {
      const r = await fetch(url, {signal:controller.signal, cache:'no-store', headers:{'Accept-Language':'it'}});
      if (!r.ok) throw new Error(r.status === 429 ? `${label}: troppe richieste. Attendi un minuto e riprova.` : `${label} non disponibile (HTTP ${r.status}). Riprova.`);
      return await r.json();
    } catch (err) {
      if (signal?.aborted) throw new DOMException('Richiesta annullata', 'AbortError');
      if (expired) throw new Error(`${label}: tempo di attesa superato. Riprova.`);
      if (err instanceof TypeError) throw new Error(`${label}: connessione non disponibile. Controlla la rete e riprova.`);
      throw err;
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
    }
  }
  function geocode(url, options = {}) {
    if (cache.has(url)) return Promise.resolve(cache.get(url));
    const task = geocodeQueue.catch(() => {}).then(async () => {
      if (options.signal?.aborted) throw new DOMException('Richiesta annullata','AbortError');
      await new Promise(resolve => setTimeout(resolve, Math.max(0,1100-(Date.now()-lastGeocode))));
      if (options.signal?.aborted) throw new DOMException('Richiesta annullata','AbortError');
      if (cache.has(url)) return cache.get(url);
      lastGeocode = Date.now();
      const result = await json(url, {...options, label:'Ricerca località'});
      if (Array.isArray(result) && result.length) {
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(url,result);
      }
      return result;
    });
    geocodeQueue = task;
    return task;
  }
  window.CarburantiServices = {json, geocode};
})();
