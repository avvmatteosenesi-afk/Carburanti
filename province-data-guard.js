(() => {
  'use strict';

  const CAPITAL_PROVINCE = new Map([
    ['AREZZO', 'AR'], ['FIRENZE', 'FI'], ['GROSSETO', 'GR'], ['LIVORNO', 'LI'],
    ['LUCCA', 'LU'], ['MASSA', 'MS'], ['CARRARA', 'MS'], ['PISA', 'PI'],
    ['PISTOIA', 'PT'], ['PRATO', 'PO'], ['SIENA', 'SI']
  ]);

  const MUNICIPALITY_PROVINCE = new Map([
    // Provincia di Prato
    ['PRATO', 'PO'], ['CANTAGALLO', 'PO'], ['CARMIGNANO', 'PO'], ['MONTEMURLO', 'PO'],
    ['POGGIO A CAIANO', 'PO'], ['VAIANO', 'PO'], ['VERNIO', 'PO'],
    // Provincia di Pistoia
    ['AGLIANA', 'PT'], ['ABETONE CUTIGLIANO', 'PT'], ['BUGGIANO', 'PT'],
    ['CHIESINA UZZANESE', 'PT'], ['LAMPORECCHIO', 'PT'], ['LARCIANO', 'PT'],
    ['MARLIANA', 'PT'], ['MASSA E COZZILE', 'PT'], ['MONSUMMANO TERME', 'PT'],
    ['MONTALE', 'PT'], ['MONTECATINI TERME', 'PT'], ['PESCIA', 'PT'],
    ['PIEVE A NIEVOLE', 'PT'], ['PISTOIA', 'PT'], ['PONTE BUGGIANESE', 'PT'],
    ['QUARRATA', 'PT'], ['SAMBUCA PISTOIESE', 'PT'], ['SAN MARCELLO PITEGLIO', 'PT'],
    ['SERRAVALLE PISTOIESE', 'PT'], ['UZZANO', 'PT']
  ]);

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

  function sanitizeStation(station) {
    if (!station || typeof station !== 'object') return station;
    const city = normalize(station.city);
    const expected = MUNICIPALITY_PROVINCE.get(city) || CAPITAL_PROVINCE.get(city);
    if (expected && normalize(station.province) !== expected) {
      station.province = expected;
      station._provinceCorrectedAtRuntime = true;
    }
    return station;
  }

  function sanitizePayload(payload) {
    if (!payload || !Array.isArray(payload.stations)) return payload;
    let corrected = 0;
    payload.stations = payload.stations.map(station => {
      const before = normalize(station?.province);
      const result = sanitizeStation(station);
      if (normalize(result?.province) !== before) corrected += 1;
      return result;
    });
    if (payload.metadata && typeof payload.metadata === 'object') {
      payload.metadata.runtime_province_corrections = corrected;
      payload.metadata.stations = payload.stations.length;
    }
    return payload;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const response = await nativeFetch(input, init);
    let url = '';
    try { url = typeof input === 'string' ? input : String(input?.url || ''); } catch (_) {}
    if (!/(?:^|\/)data\/stations(?:-it)?\.json(?:[?#]|$)/.test(url)) return response;

    try {
      const payload = sanitizePayload(await response.clone().json());
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
