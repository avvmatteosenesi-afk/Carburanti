(() => {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      if (raw && raw.startsWith('https://nominatim.openstreetmap.org/search?')) {
        const u = new URL(raw);
        const q = (u.searchParams.get('q') || '').trim();
        // A bare place name (e.g. "Lucca") must resolve as an Italian town/city,
        // not as an unrelated hamlet, road or POI with the same name.
        if (q && !/[0-9,]/.test(q) && q.split(/\s+/).length <= 4) {
          u.searchParams.set('q', `${q}, Italia`);
          u.searchParams.set('featuretype', 'city');
          u.searchParams.set('limit', '1');
          return nativeFetch(u.toString(), init);
        }
      }
    } catch (_) {}
    return nativeFetch(input, init);
  };
})();