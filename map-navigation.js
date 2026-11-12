(() => {
  'use strict';
  // Only genuine navigation gestures pause follow; programmatic pans do not.
  function bind(map, onExplore) {
    const pause=()=>{map.__carburantiManualNavigation=true;onExplore();};
    map.on('dragstart boxzoomstart',pause);
    const root=map.getContainer();
    root.addEventListener('wheel',pause,{passive:true});
    root.addEventListener('touchstart',ev=>{if(ev.touches.length>1)pause();},{passive:true});
    root.addEventListener('click',ev=>{if(ev.target.closest?.('.leaflet-control-zoom, .price-marker-wrap'))pause();},true);
    root.addEventListener('keydown',ev=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','-','='].includes(ev.key))pause();});
  }
  window.CarburantiMapNavigation={bind};
})();
