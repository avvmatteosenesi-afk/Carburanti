(() => {
  'use strict';

  const CAPITAL_PROVINCE = new Map([
    ['AREZZO', 'AR'],
    ['FIRENZE', 'FI'],
    ['GROSSETO', 'GR'],
    ['LIVORNO', 'LI'],
    ['LUCCA', 'LU'],
    ['MASSA', 'MS'],
    ['CARRARA', 'MS'],
    ['PISA', 'PI'],
    ['PISTOIA', 'PT'],
    ['PRATO', 'PO'],
    ['SIENA', 'SI']
  ]);

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  function isObviousProvinceMismatch(station) {
    const city = normalize(station?.city);
    const declared = normalize(station?.province);
    const expected = CAPITAL_PROVINCE.get(city);
    return Boolean(expected && declared && expected !== declared);
  }

  function sanitizePayload(payload) {
    if (!payload || !Array.isArray(payload.stations)) return payload;
    const before = payload.stations.length;
    payload.stations = payload.stations.filter(station => !isObviousProvinceMismatch(station));
    const removed = before - payload.stations.length;
    if (removed && payload.metadata && typeof payload.metadata === 'object') {
      payload.metadata.runtime_province_mismatches_excluded = removed;
      payload.metadata.stations = payload.stations.length;
    }
    return payload;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const response = await nativeFetch(input, init);
    let url = '';
    try { url = typeof input === 'string' ? input : String(input?.url || ''); } catch (_) {}
    if (!/(?:^|\/)data\/stations\.json(?:[?#]|$)/.test(url)) return response;

    try {
      const clone = response.clone();
      const payload = sanitizePayload(await clone.json());
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (_) {
      return response;
    }
  };
})();
