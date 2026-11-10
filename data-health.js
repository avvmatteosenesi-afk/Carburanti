(() => {
  'use strict';
  const date = value => { const d = new Date(value || ''); return Number.isNaN(d.getTime()) ? null : d; };
  const format = d => d ? d.toLocaleString('it-IT', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : 'non disponibile';
  let dialog, lastFocus;
  function render() {
    const state = window.CarburantiApp?.state, status = document.getElementById('dataStatus');
    if (!state?.loaded || !status) return;
    const m = state.metadata || {};
    const origins=Object.entries(m.api_fallback_acquired_at || {}).filter(([province])=>['AR','FI','GR','LI','LU','MS','PI','PT','PO','SI'].includes(province)).map(([,stamp])=>date(stamp)).filter(Boolean);
    const stamps=[date(m.generated_at),...origins].filter(Boolean);
    const acquired=stamps.length ? new Date(Math.min(...stamps.map(d=>d.getTime()))) : null;
    const stale = !acquired || Date.now() - acquired.getTime() > 48 * 3600000 || acquired.getTime() > Date.now() + 86400000;
    const offline = state.dataOffline || !navigator.onLine;
    const when = acquired ? acquired.toLocaleString('it-IT', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'data assente';
    status.textContent = `${stale || offline ? '⚠ ' : ''}MIMIT · acquisiti ${when}${stale ? ' · oltre 48 ore' : offline ? ' · offline' : ''} ⓘ`;
    status.classList.toggle('data-stale', stale || offline);
    status.title = `Dati acquisiti: ${format(acquired)}. Tocca per date e fonte.`;
    let notice = document.getElementById('dataFreshnessNotice');
    if (!notice) {
      notice = document.createElement('p'); notice.id = 'dataFreshnessNotice'; notice.className = 'data-freshness-notice'; notice.setAttribute('role','status');
      document.querySelector('.controls-card')?.prepend(notice);
    }
    notice.hidden = !stale && !offline;
    notice.textContent = stale ? 'Dati acquisiti da oltre 48 ore o con data non valida: controlla la comunicazione del singolo prezzo.' : 'Modalità offline: stai consultando i dati salvati sul dispositivo.';
    if (!dialog || dialog.hidden) return;
    const dates = (state.stations || []).flatMap(s => Object.values(s.prices || {}).map(p => date(p.updated))).filter(Boolean);
    const latest = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    document.getElementById('dataInfoAcquired').textContent = format(acquired);
    document.getElementById('dataInfoLatest').textContent = format(latest);
    document.getElementById('dataInfoSource').textContent = m.source || 'MIMIT';
    document.getElementById('dataInfoCoverage').textContent = `${(state.stations || []).length.toLocaleString('it-IT')} impianti Toscana${m.api_provinces ? ` · ${m.api_provinces} province acquisite in Italia` : ''}`;
    document.getElementById('dataInfoConnection').textContent = (offline ? 'Copia locale / offline' : 'Dati pubblicati disponibili') + ((m.api_fallback_provinces || []).length ? ` · province dall’ultima pubblicazione: ${m.api_fallback_provinces.map(p=>`${p} (${format(date(m.api_fallback_acquired_at?.[p]))})`).join(', ')}` : '');
  }
  function close() { dialog.hidden = true; lastFocus?.focus(); }
  function open() { lastFocus = document.activeElement; dialog.hidden = false; render(); document.getElementById('dataInfoClose').focus(); }
  document.addEventListener('DOMContentLoaded', () => {
    dialog = document.createElement('div'); dialog.id = 'dataInfoDialog'; dialog.className = 'data-info-backdrop'; dialog.hidden = true;
    dialog.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="dataInfoTitle" class="data-info-card"><div class="sheet-head"><h2 id="dataInfoTitle">Aggiornamento dati</h2><button id="dataInfoClose" class="close-btn" aria-label="Chiudi informazioni dati">×</button></div><dl><dt>Acquisizione del dataset</dt><dd id="dataInfoAcquired"></dd><dt>Prezzo comunicato più recentemente</dt><dd id="dataInfoLatest"></dd><dt>Fonte</dt><dd id="dataInfoSource"></dd><dt>Copertura</dt><dd id="dataInfoCoverage"></dd><dt>Disponibilità</dt><dd id="dataInfoConnection"></dd></dl><p>L’acquisizione indica quando il servizio ha raccolto i dati. La data nel popup è quella della comunicazione del singolo prezzo, che può essere rimasto invariato. Aggiorna ricarica i dati già pubblicati.</p></section>`;
    document.body.appendChild(dialog);
    document.getElementById('dataInfoClose').addEventListener('click', close);
    dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
    dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { e.preventDefault(); document.getElementById('dataInfoClose').focus(); }
    });
    const status = document.getElementById('dataStatus');
    status?.addEventListener('click', open);
    status?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();open();} });
    render(); setInterval(render, 60000);
  });
  window.addEventListener('carburanti:data-loaded', render);
  window.addEventListener('online', render); window.addEventListener('offline', render);
  document.addEventListener('visibilitychange', () => {if (!document.hidden) render();});
})();
