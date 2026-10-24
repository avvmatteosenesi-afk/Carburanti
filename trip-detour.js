(() => {
  'use strict';
  // A station's stored routeDistanceKm is the one-way geometric offset from the route.
  // For a stop and return to the itinerary, twice that value is a conservative detour estimate.
  // It is deliberately labelled as an estimate, not as routed-road distance.
  const obs=new MutationObserver(()=>{
    document.querySelectorAll('#tripPanel .leaflet-popup-content .popup-meta').forEach(el=>{
      if(el.dataset.detourDone)return;
      el.innerHTML=el.innerHTML.replace(/A ([0-9]+(?:[.,][0-9]+)?) km dal percorso/,(_,v)=>{
        const d=Number(v.replace(',','.')); if(!Number.isFinite(d))return _;
        return `A ${d.toFixed(1)} km dal percorso · deviazione stimata ~${(d*2).toFixed(1)} km A/R`;
      });
      el.dataset.detourDone='1';
    });
  });
  document.addEventListener('DOMContentLoaded',()=>obs.observe(document.body,{subtree:true,childList:true}));
})();
