(() => {
  'use strict';
  const VERSION='20261024-2';
  function parseDate(v){if(!v)return null;const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(v)?`${v}T00:00:00Z`:v);return Number.isNaN(d.getTime())?null:d;}
  function day(d){return d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'});}
  function time(d){return d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});}
  async function check(){
    const status=document.getElementById('dataStatus'); if(!status)return;
    try{
      const r=await fetch(`data/stations.json?v=${VERSION}`,{cache:'no-store'}); if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const p=await r.json(),m=p.metadata||{};
      const snap=parseDate(m.source_snapshot_date), generated=parseDate(m.generated_at), d=snap||generated; if(!d)return;
      const age=(Date.now()-d.getTime())/86400000, live=String(m.source_mode||'').includes('live-api');
      const when=live&&generated?`${day(generated)} ${time(generated)}`:day(d);
      status.textContent=age>2?`⚠ MIMIT · dati ${when} · non recenti`:`MIMIT · aggiornato ${when}`;
      status.classList.toggle('data-stale',age>2);
      status.title=`Fonte: ${m.source_mode||'MIMIT'}${age>2?' — dati oltre 48 ore':''}`;
    }catch(e){status.textContent='⚠ MIMIT · verifica aggiornamento non disponibile';status.classList.add('data-stale');console.warn(e);}
  }
  const obs=new MutationObserver(()=>document.querySelectorAll('.leaflet-popup-content .popup-meta').forEach(el=>{if(el.dataset.freshnessDone)return;el.innerHTML=el.innerHTML.replace(/ · aggiornato ([^<]+)<br>/,' · prezzo comunicato: $1<br>');el.dataset.freshnessDone='1';}));
  document.addEventListener('DOMContentLoaded',()=>{check();obs.observe(document.body,{subtree:true,childList:true});});
})();