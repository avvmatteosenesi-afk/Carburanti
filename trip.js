(() => {
  'use strict';

  const VERSION = '20261024-7';
  const NATIONAL_DATA_URL = `data/stations-it.json?v=${VERSION}`;
  const ITALY_CENTER = [42.5, 12.5];
  const trip = {
    map: null,
    routeLayer: null,
    stationLayer: null,
    nationalStations: null,
    fromCoords: null,
    toCoords: null,
    userPos: null,
    active: false,
    activePopup: null
  };
  const el = {};
  const qs = id => document.getElementById(id);
  const showMessage = text => { el.tripMessage.textContent = text; };
  const formatDistance = m => m >= 1000 ? `${(m / 1000).toFixed(0)} km` : `${Math.round(m)} m`;

  function formatDuration(s) {
    const min = Math.round(s / 60);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), r = min % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }

  function initTripMap() {
    if (trip.map) return;
    trip.map = L.map('tripMap', {
      minZoom: 5,
      maxZoom: 18,
      preferCanvas: true,
      closePopupOnClick: false
    }).setView(ITALY_CENTER, 6);
    window.__carburantiTripMap = trip.map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(trip.map);

    trip.map.createPane('tripStations');
    trip.map.getPane('tripStations').style.zIndex = 650;
    const popupPane = trip.map.getPane('popupPane');
    if (popupPane) {
      popupPane.style.zIndex = '1100';
      popupPane.style.pointerEvents = 'auto';
    }

    trip.routeLayer = L.layerGroup().addTo(trip.map);
    trip.stationLayer = L.layerGroup().addTo(trip.map);
  }

  function openTrip() {
    trip.active = true;
    trip.userPos = window.CarburantiApp?.getUserPosition() || null;
    el.tripPanel.classList.remove('hidden');
    el.tripPanel.setAttribute('aria-hidden', 'false');
    initTripMap();
    setTimeout(() => trip.map.invalidateSize(false), 40);
    loadNationalData().catch(err => {
      console.error(err);
      showMessage('Dati nazionali non disponibili. Riprova tra poco.');
    });
  }

  function closeTrip() {
    trip.active = false;
    try { trip.map?.closePopup(); } catch (_) {}
    trip.activePopup = null;
    el.tripPanel.classList.add('hidden');
    el.tripPanel.setAttribute('aria-hidden', 'true');
  }

  async function loadNationalData() {
    if (trip.nationalStations) return trip.nationalStations;
    showMessage('Caricamento distributori italiani…');
    const r = await fetch(NATIONAL_DATA_URL, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const p = await r.json();
    trip.nationalStations = Array.isArray(p.stations) ? p.stations : [];
    showMessage(`${trip.nationalStations.length.toLocaleString('it-IT')} distributori disponibili in Italia.`);
    return trip.nationalStations;
  }

  async function geocode(text) {
    const q = text.trim();
    if (!q) throw new Error('Inserisci una località');
    const simple = /^[\p{L}'’ .-]+$/u.test(q) && !q.includes(',');
    const params = new URLSearchParams({ format: 'jsonv2', limit: '5', countrycodes: 'it', addressdetails: '1' });
    if (simple) {
      params.set('city', q);
      params.set('country', 'Italia');
    } else {
      params.set('q', q);
    }
    let r = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { 'Accept-Language': 'it' } });
    if (!r.ok) throw new Error('Servizio di ricerca località non disponibile');
    let list = await r.json();
    if (simple && (!Array.isArray(list) || !list.length)) {
      const fallback = new URLSearchParams({
        format: 'jsonv2', limit: '10', countrycodes: 'it', addressdetails: '1', featureType: 'settlement', q: `${q}, Italia`
      });
      r = await fetch(`https://nominatim.openstreetmap.org/search?${fallback.toString()}`, { headers: { 'Accept-Language': 'it' } });
      if (!r.ok) throw new Error('Servizio di ricerca località non disponibile');
      list = await r.json();
    }
    if (!Array.isArray(list) || !list.length) throw new Error(`Località non trovata: ${q}`);
    const norm = s => String(s || '').trim().toLocaleLowerCase('it-IT');
    const wanted = norm(q);
    const exact = list.find(x => {
      const a = x.address || {};
      return [a.city, a.town, a.village, a.municipality, a.county, x.name].some(v => norm(v) === wanted);
    });
    const hit = exact || list[0];
    return { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name || q };
  }

  async function resolveEndpoint(which) {
    if (which === 'from' && trip.fromCoords) return trip.fromCoords;
    if (which === 'to' && trip.toCoords) return trip.toCoords;
    const input = which === 'from' ? el.tripFrom : el.tripTo;
    const result = await geocode(input.value);
    if (which === 'from') trip.fromCoords = result;
    else trip.toCoords = result;
    return result;
  }

  function setCurrentLocation(which) {
    const existing = window.CarburantiApp?.getUserPosition();
    if (existing && Number.isFinite(existing.lat) && Number.isFinite(existing.lon)) {
      const point = { lat: existing.lat, lon: existing.lon, label: 'Posizione attuale' };
      if (which === 'from') {
        trip.fromCoords = point;
        el.tripFrom.value = 'Posizione attuale';
      } else {
        trip.toCoords = point;
        el.tripTo.value = 'Posizione attuale';
      }
      return;
    }
    if (!navigator.geolocation) {
      showMessage('Geolocalizzazione non disponibile.');
      return;
    }
    showMessage('Rilevamento posizione…');
    navigator.geolocation.getCurrentPosition(pos => {
      const point = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Posizione attuale' };
      if (which === 'from') {
        trip.fromCoords = point;
        el.tripFrom.value = 'Posizione attuale';
      } else {
        trip.toCoords = point;
        el.tripTo.value = 'Posizione attuale';
      }
      showMessage('Posizione acquisita.');
    }, err => {
      if (err?.code === 1) showMessage('Posizione non autorizzata.');
      else if (err?.code === 3) showMessage('Rilevamento posizione troppo lento. Riprova.');
      else showMessage('Impossibile acquisire la posizione.');
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }

  function resetCoordOnInput(which) {
    if (which === 'from') trip.fromCoords = null;
    else trip.toCoords = null;
  }

  async function getRoute(from, to) {
    const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=false`);
    if (!r.ok) throw new Error('Servizio percorso non disponibile');
    const p = await r.json();
    if (p.code !== 'Ok' || !p.routes?.length) throw new Error('Percorso non trovato');
    return p.routes[0];
  }

  function isMotorwayStep(step) {
    const text = `${step.name || ''} ${step.ref || ''} ${step.destinations || ''}`.toLowerCase();
    return /\bautostrada\b|\btangenziale\b|\braccordo\b|\b[a]\s?\d{1,3}\b|\be\s?\d{1,3}\b/.test(text);
  }

  function routeMotorwayInfo(route) {
    const steps = (route.legs || []).flatMap(l => l.steps || []);
    const motorwaySteps = steps.filter(isMotorwayStep);
    const motorwayDistance = motorwaySteps.reduce((sum, s) => sum + (s.distance || 0), 0);
    const ratio = route.distance ? motorwayDistance / route.distance : 0;
    return { motorwayDistance, ratio, significant: motorwayDistance >= 10000 && ratio >= 0.18, motorwaySteps };
  }

  function reduceRoutePoints(coords, maxPoints = 360) {
    if (!Array.isArray(coords) || coords.length <= maxPoints) return coords || [];
    const step = (coords.length - 1) / (maxPoints - 1), out = [];
    for (let i = 0; i < maxPoints; i++) out.push(coords[Math.round(i * step)]);
    return out;
  }

  function localXY(lat, lon, refLat) {
    return [lon * 111.32 * Math.cos(refLat * Math.PI / 180), lat * 111.32];
  }

  function pointSegmentDistanceKm(p, a, b, refLat) {
    const [px, py] = localXY(p[1], p[0], refLat), [ax, ay] = localXY(a[1], a[0], refLat), [bx, by] = localXY(b[1], b[0], refLat);
    const dx = bx - ax, dy = by - ay;
    if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function distanceToPolylineKm(station, coords) {
    if (!coords || coords.length < 2) return Infinity;
    const p = [station.lon, station.lat], refLat = station.lat;
    let min = Infinity;
    for (let i = 1; i < coords.length; i++) {
      const d = pointSegmentDistanceKm(p, coords[i - 1], coords[i], refLat);
      if (d < min) min = d;
      if (min < 0.08) break;
    }
    return min;
  }

  function distanceToSegmentsKm(station, segments) {
    let min = Infinity;
    for (const coords of segments || []) {
      const d = distanceToPolylineKm(station, coords);
      if (d < min) min = d;
      if (min < 0.08) break;
    }
    return min;
  }

  function stepCoords(step) {
    const c = step?.geometry?.coordinates;
    return Array.isArray(c) && c.length > 1 ? c : [];
  }

  function segmentedRoute(route) {
    const steps = (route.legs || []).flatMap(l => l.steps || []);
    const motorway = [], local = [];
    for (const step of steps) {
      const c = stepCoords(step);
      if (c.length < 2) continue;
      const reduced = reduceRoutePoints(c, 120);
      (isMotorwayStep(step) ? motorway : local).push(reduced);
    }
    return { motorway, local };
  }

  function candidateAlongRoute(route, motorwayInfo) {
    const fuel = window.CarburantiApp?.getFuel() || 'benzina';
    const full = reduceRoutePoints(route.geometry.coordinates || [], 420);
    if (full.length < 2) return [];
    const seg = segmentedRoute(route), lons = full.map(c => c[0]), lats = full.map(c => c[1]);
    const padKm = 2.7, latPad = padKm / 111, midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const lonPad = padKm / (111 * Math.max(.25, Math.cos(midLat * Math.PI / 180)));
    const bbox = {
      minLat: Math.min(...lats) - latPad,
      maxLat: Math.max(...lats) + latPad,
      minLon: Math.min(...lons) - lonPad,
      maxLon: Math.max(...lons) + lonPad
    };
    return trip.nationalStations
      .filter(s => {
        if (s.lat < bbox.minLat || s.lat > bbox.maxLat || s.lon < bbox.minLon || s.lon > bbox.maxLon) return false;
        const p = Number(s.prices?.[fuel]?.price);
        return Number.isFinite(p) && p > 0;
      })
      .map(s => {
        const motorwayDistanceKm = distanceToSegmentsKm(s, seg.motorway);
        const localDistanceKm = distanceToSegmentsKm(s, seg.local);
        const routeDistanceKm = Math.min(motorwayDistanceKm, localDistanceKm);
        return { ...s, motorwayDistanceKm, localDistanceKm, routeDistanceKm };
      })
      .filter(s => {
        if (!motorwayInfo.significant) return s.routeDistanceKm <= 2.5;
        if (s.highway) return s.motorwayDistanceKm <= 1.6 && s.motorwayDistanceKm <= s.localDistanceKm;
        return s.localDistanceKm <= 2.5 && s.localDistanceKm < s.motorwayDistanceKm;
      })
      .sort((a, b) => a.routeDistanceKm - b.routeDistanceKm);
  }

  function priceClass(price, min) {
    const d = price - min;
    if (d <= .0005) return 'best';
    if (d <= .0505) return 'near';
    if (d <= .1005) return 'good';
    return 'normal';
  }

  function priceIcon(price, cls) {
    return L.divIcon({
      className: 'price-marker-wrap',
      html: `<div class="price-marker ${cls}">${price.toFixed(3)}</div>`,
      iconSize: [58, 28],
      iconAnchor: [29, 14]
    });
  }

  function popupHtml(station, price) {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${station.lat},${station.lon}`)}`;
    return `<div class="trip-popup-inner" style="position:relative;min-width:210px;padding:2px 34px 2px 0">
      <button type="button" class="trip-popup-x" aria-label="Chiudi" title="Chiudi" style="position:absolute;right:-2px;top:-7px;width:32px;height:32px;border:0;background:transparent;color:#17212b;font-size:27px;line-height:30px;font-weight:900;cursor:pointer;z-index:30;padding:0">×</button>
      <div class="popup-title">${window.CarburantiApp.escapeHtml(station.name || station.brand || 'Distributore')}</div>
      <div class="popup-price">${window.CarburantiApp.money(price)}</div>
      <div class="popup-meta">${window.CarburantiApp.escapeHtml(station.address || '')}${station.city ? ` · ${window.CarburantiApp.escapeHtml(station.city)}` : ''}<br>${station.highway ? 'Area/distributore autostradale' : `A ${station.routeDistanceKm.toFixed(1)} km dal percorso`}<br><a class="trip-popup-directions" href="${mapsUrl}" target="_blank" rel="noopener">Indicazioni</a></div>
    </div>`;
  }

  function popupCenterFor(latlng, zoom) {
    const size = trip.map.getSize();
    const markerPoint = trip.map.project(latlng, zoom);
    const verticalOffset = Math.max(36, Math.min(72, size.y * 0.15));
    return trip.map.unproject(markerPoint.subtract(L.point(0, verticalOffset)), zoom);
  }

  function protectOpenPopup(popup) {
    const root = popup?.getElement?.();
    if (!root) return;
    root.style.pointerEvents = 'auto';
    try { L.DomEvent.disableClickPropagation(root); } catch (_) {}
    try { L.DomEvent.disableScrollPropagation(root); } catch (_) {}

    const close = root.querySelector('.trip-popup-x');
    if (close && !close.__tripBound) {
      close.__tripBound = true;
      ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup'].forEach(type => {
        close.addEventListener(type, ev => ev.stopPropagation(), { passive: true });
      });
      close.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
        try { trip.map.closePopup(popup); } catch (_) { try { trip.map.closePopup(); } catch (_) {} }
        trip.activePopup = null;
      });
    }

    root.querySelectorAll('a').forEach(link => {
      link.style.pointerEvents = 'auto';
      link.style.touchAction = 'manipulation';
      if (link.__tripBound) return;
      link.__tripBound = true;
      ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click'].forEach(type => {
        link.addEventListener(type, ev => ev.stopPropagation());
      });
    });
  }

  function openStationPopup(marker, html) {
    const latlng = marker.getLatLng();
    if (!latlng) return;

    try { trip.map.stop(); } catch (_) {}
    try { trip.map.closePopup(); } catch (_) {}

    const zoom = Math.min(Math.max(trip.map.getZoom(), 15), trip.map.getMaxZoom());
    const targetCenter = popupCenterFor(latlng, zoom);
    let opened = false;

    const open = () => {
      if (opened) return;
      opened = true;
      const popup = L.popup({
        maxWidth: 280,
        minWidth: 210,
        autoPan: false,
        keepInView: false,
        closeButton: false,
        closeOnClick: false,
        offset: [0, -13],
        className: 'trip-station-popup'
      }).setLatLng(latlng).setContent(html).openOn(trip.map);
      trip.activePopup = popup;
      requestAnimationFrame(() => protectOpenPopup(popup));
      setTimeout(() => protectOpenPopup(popup), 60);
    };

    try { trip.map.once('moveend', open); } catch (_) {}
    trip.map.setView(targetCenter, zoom, { animate: false });
    setTimeout(open, 80);
  }

  function renderRoute(route, stations, motorwayInfo) {
    try { trip.map.closePopup(); } catch (_) {}
    trip.activePopup = null;
    trip.routeLayer.clearLayers();
    trip.stationLayer.clearLayers();

    const latLngs = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const line = L.polyline(latLngs, { color: '#1267d6', weight: 6, opacity: .88 }).addTo(trip.routeLayer);
    const fuel = window.CarburantiApp?.getFuel() || 'benzina';
    const prices = stations.map(s => Number(s.prices?.[fuel]?.price)).filter(Number.isFinite);
    const min = prices.length ? Math.min(...prices) : null;

    for (const station of stations) {
      const price = Number(station.prices?.[fuel]?.price);
      if (!Number.isFinite(price) || !Number.isFinite(station.lat) || !Number.isFinite(station.lon)) continue;
      const marker = L.marker([station.lat, station.lon], {
        pane: 'tripStations',
        icon: priceIcon(price, priceClass(price, min)),
        riseOnHover: true,
        bubblingMouseEvents: false
      }).addTo(trip.stationLayer);
      const html = popupHtml(station, price);
      marker.on('click', ev => {
        try { L.DomEvent.stopPropagation(ev.originalEvent); } catch (_) {}
        openStationPopup(marker, html);
      });
    }

    trip.map.invalidateSize(false);
    const routeBounds = line.getBounds().pad(.035);
    setTimeout(() => {
      trip.map.invalidateSize(false);
      trip.map.fitBounds(routeBounds, {
        paddingTopLeft: [30, 34],
        paddingBottomRight: [30, 34],
        maxZoom: 13,
        animate: false
      });
    }, 40);

    el.tripDistance.textContent = formatDistance(route.distance);
    el.tripDuration.textContent = formatDuration(route.duration);
    el.tripBest.textContent = min !== null ? window.CarburantiApp.money(min) : '—';
    el.tripSummary.classList.remove('hidden');

    if (motorwayInfo.significant) {
      const h = stations.filter(s => s.highway).length, l = stations.length - h;
      showMessage(`${h} distributori autostradali sui tratti in autostrada; ${l} distributori ordinari sui soli tratti fuori autostrada.`);
    } else {
      showMessage(`${stations.length} distributori entro circa 2,5 km dal percorso.`);
    }
  }

  async function calculateTrip() {
    el.tripGoBtn.disabled = true;
    el.tripGoBtn.textContent = 'Calcolo…';
    try {
      await loadNationalData();
      showMessage('Ricerca località e calcolo del percorso…');
      const [from, to] = await Promise.all([resolveEndpoint('from'), resolveEndpoint('to')]);
      const route = await getRoute(from, to), info = routeMotorwayInfo(route);
      showMessage(info.significant ? 'Autostrada rilevata: separo rigorosamente autostrada e viabilità ordinaria…' : 'Ricerca distributori vicini al percorso…');
      const stations = candidateAlongRoute(route, info);
      renderRoute(route, stations, info);
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Impossibile calcolare il viaggio.');
    } finally {
      el.tripGoBtn.disabled = false;
      el.tripGoBtn.textContent = 'Calcola percorso';
    }
  }

  function bind() {
    Object.assign(el, {
      tripOpenBtn: qs('tripOpenBtn'), tripPanel: qs('tripPanel'), tripCloseBtn: qs('tripCloseBtn'),
      tripEndBtn: qs('tripEndBtn'), tripFrom: qs('tripFrom'), tripTo: qs('tripTo'),
      tripFromLocation: qs('tripFromLocation'), tripToLocation: qs('tripToLocation'), tripGoBtn: qs('tripGoBtn'),
      tripSummary: qs('tripSummary'), tripDistance: qs('tripDistance'), tripDuration: qs('tripDuration'),
      tripBest: qs('tripBest'), tripMessage: qs('tripMessage')
    });
    el.tripOpenBtn.addEventListener('click', openTrip);
    el.tripCloseBtn.addEventListener('click', closeTrip);
    el.tripEndBtn.addEventListener('click', closeTrip);
    el.tripFromLocation.addEventListener('click', () => setCurrentLocation('from'));
    el.tripToLocation.addEventListener('click', () => setCurrentLocation('to'));
    el.tripFrom.addEventListener('input', () => resetCoordOnInput('from'));
    el.tripTo.addEventListener('input', () => resetCoordOnInput('to'));
    el.tripGoBtn.addEventListener('click', calculateTrip);
    [el.tripFrom, el.tripTo].forEach(input => input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') calculateTrip();
    }));
  }

  document.addEventListener('DOMContentLoaded', bind);
})();