(() => {
  'use strict';

  const VERSION = '20261020-1';
  const DATA_URL = `data/stations.json?v=${VERSION}`;
  const PREFS_KEY = 'carburanti:prefs:v2';
  const TUSCANY_CENTER = [43.42, 11.10];
  const TUSCANY_BOUNDS = [[42.20, 9.72], [44.53, 12.22]];

  const PROVINCES = {
    AR: { center: [43.46, 11.88], zoom: 10, bounds: [[43.18, 11.35], [43.84, 12.18]] },
    FI: { center: [43.78, 11.25], zoom: 10, bounds: [[43.42, 10.67], [44.19, 11.72]] },
    GR: { center: [42.78, 11.10], zoom: 9, bounds: [[42.22, 10.61], [43.24, 11.70]] },
    LI: { center: [43.16, 10.45], zoom: 9, bounds: [[42.70, 9.70], [43.62, 10.72]] },
    LU: { center: [43.98, 10.50], zoom: 10, bounds: [[43.69, 10.08], [44.31, 10.78]] },
    MS: { center: [44.18, 10.05], zoom: 10, bounds: [[43.97, 9.78], [44.50, 10.36]] },
    PI: { center: [43.57, 10.60], zoom: 10, bounds: [[43.34, 10.30], [43.86, 10.96]] },
    PO: { center: [43.90, 11.10], zoom: 11, bounds: [[43.78, 10.91], [44.14, 11.25]] },
    PT: { center: [43.97, 10.88], zoom: 10, bounds: [[43.78, 10.58], [44.20, 11.08]] },
    SI: { center: [43.18, 11.33], zoom: 9, bounds: [[42.89, 10.80], [43.58, 11.82]] }
  };

  const QUICK_ZONES = {
    'pistoia-firenze': { bounds: [[43.71, 10.82], [43.99, 11.34]], center: [43.84, 11.08], zoom: 10 },
    'pistoia-prato': { bounds: [[43.82, 10.82], [44.00, 11.18]], center: [43.91, 11.00], zoom: 11 },
    'prato-firenze': { bounds: [[43.70, 11.02], [43.94, 11.35]], center: [43.82, 11.18], zoom: 11 },
    'pistoia-agliana': { bounds: [[43.86, 10.84], [43.98, 11.02]], center: [43.92, 10.93], zoom: 12 },
    'agliana-prato': { bounds: [[43.84, 10.96], [43.93, 11.14]], center: [43.885, 11.05], zoom: 12 }
  };

  const state = {
    map: null,
    stationLayer: null,
    userLayer: null,
    stations: [],
    metadata: null,
    fuel: 'benzina',
    zone: 'tuscany',
    userPos: null,
    programmaticMove: false,
    loaded: false,
    lastVisibleStations: []
  };

  const el = {};

  function qs(id) { return document.getElementById(id); }
  function money(value) { return Number.isFinite(value) ? `${value.toFixed(3)} €` : '—'; }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function loadPrefs() {
    try {
      const stored = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      return {
        fuel: ['benzina', 'gasolio', 'gpl', 'metano'].includes(stored.fuel) ? stored.fuel : 'benzina',
        zone: typeof stored.zone === 'string' ? stored.zone : 'tuscany'
      };
    } catch {
      return { fuel: 'benzina', zone: 'tuscany' };
    }
  }

  function savePrefs(fuel, zone) {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ fuel, zone }));
  }

  function haversineKm(aLat, aLon, bLat, bLon) {
    const R = 6371;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function getFuelPrice(station, fuel = state.fuel) {
    const info = station.prices && station.prices[fuel];
    const p = Number(info && info.price);
    return Number.isFinite(p) && p > 0 ? p : null;
  }

  function stationHasFuel(station, fuel = state.fuel) { return getFuelPrice(station, fuel) !== null; }

  function setStatus(text) { el.dataStatus.textContent = text; }

  function initMap() {
    state.map = L.map('map', {
      zoomControl: true,
      preferCanvas: true,
      minZoom: 6,
      maxZoom: 18
    }).setView(TUSCANY_CENTER, 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);

    state.map.createPane('stationPane');
    state.map.getPane('stationPane').style.zIndex = 650;
    state.map.createPane('userPane');
    state.map.getPane('userPane').style.zIndex = 720;

    state.stationLayer = L.layerGroup().addTo(state.map);
    state.userLayer = L.layerGroup().addTo(state.map);

    state.map.on('moveend', () => {
      if (!state.loaded) return;
      if (!state.programmaticMove) maybeSwitchToFreeMode();
      state.programmaticMove = false;
      renderStations();
    });
  }

  function maybeSwitchToFreeMode() {
    if (state.zone === 'free') return;
    const center = state.map.getCenter();
    let outside = false;

    if (state.zone === 'position' && state.userPos) {
      outside = haversineKm(center.lat, center.lng, state.userPos.lat, state.userPos.lon) > 30;
    } else if (state.zone === 'tuscany') {
      outside = !L.latLngBounds(TUSCANY_BOUNDS).contains(center);
    } else if (state.zone.startsWith('province:')) {
      const p = PROVINCES[state.zone.split(':')[1]];
      outside = p ? !L.latLngBounds(p.bounds).contains(center) : false;
    } else if (state.zone.startsWith('quick:')) {
      const q = QUICK_ZONES[state.zone.split(':')[1]];
      outside = q ? !L.latLngBounds(q.bounds).contains(center) : false;
    }

    if (outside) {
      state.zone = 'free';
      el.zoneSelect.value = 'free';
      el.freeModeBadge.classList.remove('hidden');
      showMapNotice('Modalità Libera: distributori aggiornati nell’area visibile');
    }
  }

  function showMapNotice(text, ms = 2400) {
    el.mapNotice.textContent = text;
    el.mapNotice.classList.remove('hidden');
    window.clearTimeout(showMapNotice._t);
    showMapNotice._t = window.setTimeout(() => el.mapNotice.classList.add('hidden'), ms);
  }

  function createPriceIcon(price, cls) {
    return L.divIcon({
      className: 'price-marker-wrap',
      html: `<div class="price-marker ${cls}">${price.toFixed(3)}</div>`,
      iconSize: [58, 28],
      iconAnchor: [29, 14],
      popupAnchor: [0, -13]
    });
  }

  function priceClass(price, referenceMin, visibleMin, isFree) {
    if (Number.isFinite(referenceMin)) {
      const d = price - referenceMin;
      if (d <= 0.0005) return 'best';
      if (d <= 0.0105) return 'near';
      if (d <= 0.0305) return 'good';
    }
    if (isFree && Number.isFinite(visibleMin) && price - visibleMin <= 0.0305) return 'good';
    return 'normal';
  }

  function markerPopup(station, price) {
    const p = station.prices[state.fuel] || {};
    const updated = p.updated ? new Date(p.updated) : null;
    const updatedText = updated && !Number.isNaN(updated.getTime())
      ? updated.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'dato MIMIT';
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${station.lat},${station.lon}`)}`;
    return `
      <div class="popup-title">${escapeHtml(station.name || station.brand || 'Distributore')}</div>
      <div class="popup-price">${money(price)}</div>
      <div class="popup-meta">
        ${escapeHtml(station.brand || '')}${station.brand ? '<br>' : ''}
        ${escapeHtml(station.address || '')}${station.city ? ` · ${escapeHtml(station.city)}` : ''}<br>
        ${p.self === false ? 'Servito' : 'Self'} · aggiornato ${escapeHtml(updatedText)}<br>
        <a href="${mapsUrl}" target="_blank" rel="noopener">Indicazioni</a>
      </div>`;
  }

  function currentReferenceStations() {
    const withFuel = state.stations.filter(s => stationHasFuel(s));
    if (state.userPos) {
      return withFuel.filter(s => haversineKm(state.userPos.lat, state.userPos.lon, s.lat, s.lon) <= 30);
    }
    if (state.zone.startsWith('province:')) {
      const code = state.zone.split(':')[1];
      return withFuel.filter(s => s.province === code);
    }
    if (state.zone.startsWith('quick:')) {
      const q = QUICK_ZONES[state.zone.split(':')[1]];
      const b = q && L.latLngBounds(q.bounds);
      return b ? withFuel.filter(s => b.contains([s.lat, s.lon])) : withFuel;
    }
    if (state.zone === 'free') {
      const c = state.map.getCenter();
      return withFuel.filter(s => haversineKm(c.lat, c.lng, s.lat, s.lon) <= 30);
    }
    return withFuel;
  }

  function candidateStations() {
    const withFuel = state.stations.filter(s => stationHasFuel(s));
    if (state.zone === 'position' && state.userPos) {
      return withFuel.filter(s => haversineKm(state.userPos.lat, state.userPos.lon, s.lat, s.lon) <= 10);
    }
    if (state.zone.startsWith('province:')) {
      const code = state.zone.split(':')[1];
      return withFuel.filter(s => s.province === code);
    }
    if (state.zone.startsWith('quick:')) {
      const q = QUICK_ZONES[state.zone.split(':')[1]];
      const b = q && L.latLngBounds(q.bounds);
      return b ? withFuel.filter(s => b.contains([s.lat, s.lon])) : [];
    }
    if (state.zone === 'free') {
      const b = state.map.getBounds().pad(0.12);
      return withFuel.filter(s => b.contains([s.lat, s.lon]));
    }
    return withFuel;
  }

  function renderStations() {
    if (!state.loaded || !state.stationLayer) return;
    const candidates = candidateStations();
    const bounds = state.map.getBounds();
    const visible = candidates.filter(s => bounds.contains([s.lat, s.lon]));
    const reference = currentReferenceStations();
    const refPrices = reference.map(s => getFuelPrice(s)).filter(Number.isFinite);
    const visiblePrices = visible.map(s => getFuelPrice(s)).filter(Number.isFinite);
    const referenceMin = refPrices.length ? Math.min(...refPrices) : null;
    const visibleMin = visiblePrices.length ? Math.min(...visiblePrices) : null;

    state.lastVisibleStations = visible;
    state.stationLayer.clearLayers();

    const maxMarkers = state.map.getZoom() <= 8 ? 450 : state.map.getZoom() <= 10 ? 800 : 1600;
    let draw = candidates;
    if (draw.length > maxMarkers) {
      const center = state.map.getCenter();
      draw = [...draw]
        .sort((a, b) => haversineKm(center.lat, center.lng, a.lat, a.lon) - haversineKm(center.lat, center.lng, b.lat, b.lon))
        .slice(0, maxMarkers);
    }

    for (const station of draw) {
      const price = getFuelPrice(station);
      if (price === null) continue;
      const cls = priceClass(price, referenceMin, visibleMin, state.zone === 'free');
      const marker = L.marker([station.lat, station.lon], {
        pane: 'stationPane',
        icon: createPriceIcon(price, cls),
        riseOnHover: true
      });
      marker.bindPopup(markerPopup(station, price), { maxWidth: 280 });
      marker.addTo(state.stationLayer);
    }

    updateStats(reference, visible, referenceMin);
  }

  function updateStats(reference, visible, referenceMin) {
    const label = document.querySelector('.best-card .stat-label');
    label.textContent = state.userPos ? 'Minimo entro 30 km' : (state.zone === 'free' ? 'Minimo entro 30 km dal centro' : 'Minimo zona');

    let bestStation = null;
    if (Number.isFinite(referenceMin)) {
      bestStation = reference.find(s => Math.abs(getFuelPrice(s) - referenceMin) < 0.0005) || null;
    }
    el.bestPrice.textContent = money(referenceMin);
    el.bestStation.textContent = bestStation ? `${bestStation.name || bestStation.brand || 'Impianto'} · ${bestStation.city || ''}` : '—';

    const vp = visible.map(s => getFuelPrice(s)).filter(Number.isFinite);
    const avg = vp.length ? vp.reduce((a, b) => a + b, 0) / vp.length : null;
    el.avgPrice.textContent = money(avg);
    el.visibleCount.textContent = `${visible.length} ${visible.length === 1 ? 'impianto' : 'impianti'}`;
  }

  function setFuel(fuel, { persistDefault = false } = {}) {
    state.fuel = fuel;
    document.querySelectorAll('.fuel-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.fuel === fuel));
    if (persistDefault) {
      const prefs = loadPrefs();
      savePrefs(fuel, prefs.zone);
    }
    renderStations();
  }

  function mapSetView(center, zoom) {
    state.programmaticMove = true;
    state.map.setView(center, zoom, { animate: false });
  }

  function mapFitBounds(bounds, maxZoom = 12) {
    state.programmaticMove = true;
    state.map.fitBounds(bounds, { padding: [18, 18], maxZoom, animate: false });
  }

  function setZone(zone, { requestLocation = true } = {}) {
    state.zone = zone;
    el.zoneSelect.value = zone;
    el.freeModeBadge.classList.toggle('hidden', zone !== 'free');

    if (zone === 'position') {
      if (state.userPos) {
        mapSetView([state.userPos.lat, state.userPos.lon], 13);
        renderStations();
      } else if (requestLocation) {
        locateUser(true);
      }
      return;
    }

    if (zone === 'tuscany') {
      mapFitBounds(TUSCANY_BOUNDS, 9);
    } else if (zone === 'free') {
      renderStations();
    } else if (zone.startsWith('province:')) {
      const p = PROVINCES[zone.split(':')[1]];
      if (p) mapFitBounds(p.bounds, p.zoom);
    } else if (zone.startsWith('quick:')) {
      const q = QUICK_ZONES[zone.split(':')[1]];
      if (q) mapFitBounds(q.bounds, q.zoom);
    }
  }

  function drawUserLocation() {
    state.userLayer.clearLayers();
    if (!state.userPos) return;
    const icon = L.divIcon({ className: '', html: '<div class="user-location"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });
    L.marker([state.userPos.lat, state.userPos.lon], { pane: 'userPane', icon, zIndexOffset: 10000 })
      .bindPopup('La tua posizione')
      .addTo(state.userLayer);
  }

  function locateUser(centerAfter = true) {
    if (!navigator.geolocation) {
      showMapNotice('Geolocalizzazione non disponibile su questo dispositivo');
      return;
    }
    showMapNotice('Rilevamento posizione…', 5000);
    navigator.geolocation.getCurrentPosition(pos => {
      state.userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
      drawUserLocation();
      if (centerAfter) {
        state.zone = 'position';
        el.zoneSelect.value = 'position';
        el.freeModeBadge.classList.add('hidden');
        mapSetView([state.userPos.lat, state.userPos.lon], 13);
      }
      renderStations();
      showMapNotice('Posizione aggiornata');
      window.dispatchEvent(new CustomEvent('carburanti:location', { detail: state.userPos }));
    }, err => {
      showMapNotice(err.code === 1 ? 'Permesso posizione non concesso' : 'Impossibile rilevare la posizione');
      if (state.zone === 'position') setZone('tuscany', { requestLocation: false });
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
  }

  function bindUi() {
    document.querySelectorAll('.fuel-tab').forEach(btn => btn.addEventListener('click', () => setFuel(btn.dataset.fuel)));
    el.zoneSelect.addEventListener('change', () => setZone(el.zoneSelect.value));
    el.locateBtn.addEventListener('click', () => locateUser(true));
    el.freeModeBadge.addEventListener('click', () => setZone('position'));

    el.settingsBtn.addEventListener('click', openSettings);
    el.settingsCloseBtn.addEventListener('click', closeSettings);
    el.settingsPanel.addEventListener('click', ev => { if (ev.target === el.settingsPanel) closeSettings(); });
    el.saveSettingsBtn.addEventListener('click', () => {
      savePrefs(el.defaultFuelSelect.value, el.defaultZoneSelect.value);
      state.fuel = el.defaultFuelSelect.value;
      document.querySelectorAll('.fuel-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.fuel === state.fuel));
      closeSettings();
      setZone(el.defaultZoneSelect.value);
      renderStations();
      showMapNotice('Impostazioni salvate');
    });
  }

  function openSettings() {
    const prefs = loadPrefs();
    el.defaultFuelSelect.value = prefs.fuel;
    el.defaultZoneSelect.value = prefs.zone;
    el.settingsPanel.classList.remove('hidden');
    el.settingsPanel.setAttribute('aria-hidden', 'false');
  }

  function closeSettings() {
    el.settingsPanel.classList.add('hidden');
    el.settingsPanel.setAttribute('aria-hidden', 'true');
  }

  async function loadData() {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.metadata = payload.metadata || {};
    state.stations = Array.isArray(payload.stations) ? payload.stations : [];
    state.loaded = true;

    const stamp = state.metadata.generated_at ? new Date(state.metadata.generated_at) : null;
    const dateText = stamp && !Number.isNaN(stamp.getTime())
      ? stamp.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'dato disponibile';
    setStatus(`${state.stations.length.toLocaleString('it-IT')} impianti · agg. ${dateText}`);
  }

  async function init() {
    Object.assign(el, {
      dataStatus: qs('dataStatus'), zoneSelect: qs('zoneSelect'), locateBtn: qs('locateBtn'),
      bestPrice: qs('bestPrice'), bestStation: qs('bestStation'), avgPrice: qs('avgPrice'), visibleCount: qs('visibleCount'),
      mapNotice: qs('mapNotice'), freeModeBadge: qs('freeModeBadge'), settingsBtn: qs('settingsBtn'),
      settingsPanel: qs('settingsPanel'), settingsCloseBtn: qs('settingsCloseBtn'), defaultFuelSelect: qs('defaultFuelSelect'),
      defaultZoneSelect: qs('defaultZoneSelect'), saveSettingsBtn: qs('saveSettingsBtn')
    });

    initMap();
    bindUi();
    const prefs = loadPrefs();
    state.fuel = prefs.fuel;
    state.zone = prefs.zone;
    document.querySelectorAll('.fuel-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.fuel === state.fuel));
    el.zoneSelect.value = state.zone;

    try {
      await loadData();
      setZone(state.zone);
      renderStations();
    } catch (error) {
      console.error(error);
      setStatus('Dati non disponibili');
      showMapNotice('Impossibile caricare i dati carburanti', 5000);
    }

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register(`sw.js?v=${VERSION}`, { scope: './' });
        registration.update().catch(() => {});
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          location.reload();
        });
      } catch (e) {
        console.warn('Service worker non registrato', e);
      }
    }
  }

  window.CarburantiApp = {
    state,
    getFuel: () => state.fuel,
    getUserPosition: () => state.userPos,
    locateUser,
    haversineKm,
    money,
    escapeHtml
  };

  document.addEventListener('DOMContentLoaded', init);
})();
