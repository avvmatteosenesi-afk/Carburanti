(() => {
  'use strict';
  const VERSION='20261024-1';
  function parseDate(v){if(!v)return null;const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(v)?`${v}T00:00:00Z`:v);return Number.isNaN(d.getTime())?null:d;}
  function fmt(d){return d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});}
  async function check(){
    const status=document.getElementById('dataStatus'); if(!status)return;
    try{
      const r=await fetch(`data/stations.json?v=${VERSION}`,{cache:'no-store'}); if(!r.ok)return;
      const p=await r.json(),m=p.metadata||{};
      const d=parseDate(m.source_snapshot_date)||parseDate(m.generated_at); if(!d)return;
      const age=(Date.now()-d.getTime())/86400000;
      const base=`Prezzi MIMIT · dati ${fmt(d)}`;
      status.textContent=age>2?`⚠ ${base} · aggiornamento non recente`:base;
      status.classList.toggle('data-stale',age>2);
      status.title=`Fonte: ${m.source_mode||'MIMIT'}${age>2?' — dati oltre 48 ore':''}`;
    }catch(e){console.warn('Controllo freschezza dati non disponibile',e);}
  }
  // Normalize popup wording so the communication timestamp is explicit.
  document.addEventListener('popupopen',()=>{});
  const obs=new MutationObserver(()=>{
    document.querySelectorAll('.leaflet-popup-content .popup-meta').forEach(el=>{
      if(el.dataset.freshnessDone)return;
      el.innerHTML=el.innerHTML.replace(/ · aggiornato ([^<]+)<br>/,' · prezzo comunicato: $1<br>');
      el.dataset.freshnessDone='1';
    });
  });
  document.addEventListener('DOMContentLoaded',()=>{check();obs.observe(document.body,{subtree:true,childList:true});});
})();
