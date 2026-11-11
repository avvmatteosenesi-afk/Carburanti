const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
async function setup(page){
 await page.addInitScript(()=>{
  localStorage.setItem('carburanti:geo-consent:v3','1');localStorage.removeItem('carburanti:last-position:v1');localStorage.setItem('carburanti:prefs:v3',JSON.stringify({fuel:'benzina',zone:'position'}));
  let point={coords:{latitude:43.9022,longitude:11.0069,accuracy:12},timestamp:Date.now()},next=0;
  const watchers=new Map();window.__watchStats={started:0,cleared:0};
  navigator.geolocation.getCurrentPosition=success=>queueMicrotask(()=>success(point));
  navigator.geolocation.watchPosition=(success,error)=>{const id=next++;watchers.set(id,{success,error});window.__watchStats.started++;queueMicrotask(()=>{if(watchers.has(id))success(point);});return id;};
  navigator.geolocation.clearWatch=id=>{watchers.delete(id);window.__watchStats.cleared++;};
  window.__pushGps=(lat,lon)=>{point={coords:{latitude:lat,longitude:lon,accuracy:12},timestamp:Math.max(point.timestamp+1,Date.now())};watchers.forEach(w=>w.success(point));};
  window.__denyGps=()=>watchers.forEach(w=>w.error({code:1}));
  window.__gpsHidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__gpsHidden});
 });
 await page.goto('./',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.CarburantiApp?.state?.locationWatchId)).not.toBeNull();
 await expect.poll(()=>page.evaluate(()=>window.CarburantiApp?.state?.loaded)).toBeTruthy();
 await page.waitForTimeout(500);
}
test('moving GPS updates the open local map, dot, radius and prices without a tap',async({page})=>{
 await setup(page);
 await page.evaluate(()=>window.CarburantiApp.state.map.setZoom(16,{animate:false}));
 await page.evaluate(()=>window.__pushGps(43.94,11.04));
 await expect.poll(()=>page.evaluate(()=>window.CarburantiApp.getUserPosition().lat)).toBe(43.94);
 await expect.poll(()=>page.evaluate(()=>window.CarburantiApp.state.map.getCenter().lat)).toBeCloseTo(43.94,3);
 expect(await page.evaluate(()=>window.CarburantiApp.state.map.getZoom())).toBe(16);
 await expect(page.locator('#zoneSelect')).toHaveValue('position');
 const positions=await page.evaluate(()=>window.CarburantiApp.state.userLayer.getLayers().map(l=>l.getLatLng().lat));
 expect(positions.every(lat=>Math.abs(lat-43.94)<0.0001)).toBeTruthy();
 const outside=await page.evaluate(()=>{const a=window.CarburantiApp;return a.state.lastVisibleStations.some(s=>a.haversineKm(43.94,11.04,s.lat,s.lon)>10.001);});expect(outside).toBeFalsy();
});
test('watch is unique and resumes with a fresh fix after backgrounding',async({page})=>{
 await setup(page);
 const before=await page.evaluate(()=>window.__watchStats.started);
 await page.evaluate(()=>{window.__gpsHidden=true;document.dispatchEvent(new Event('visibilitychange'));});
 expect(await page.evaluate(()=>window.CarburantiApp.state.locationWatchId)).toBeNull();
 await page.evaluate(()=>{window.__pushGps(43.96,11.07);window.__gpsHidden=false;document.dispatchEvent(new Event('visibilitychange'));document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(()=>page.evaluate(()=>window.CarburantiApp.getUserPosition().lat)).toBe(43.96);
 expect(await page.evaluate(()=>window.__watchStats.started)).toBe(before+1);
});
test('other selected zones keep their framing while the position updates',async({page})=>{
 await setup(page);await page.locator('#zoneSelect').selectOption('province:PO');await page.waitForTimeout(400);
 const center=await page.evaluate(()=>window.CarburantiApp.state.map.getCenter());
 await page.evaluate(()=>window.__pushGps(43.97,11.09));
 await expect(page.locator('#zoneSelect')).toHaveValue('province:PO');
 expect(await page.evaluate(()=>window.CarburantiApp.state.map.getCenter())).toEqual(center);
 expect(await page.evaluate(()=>window.CarburantiApp.getUserPosition().lat)).toBe(43.97);
});
test('the open trip map follows live position despite delayed initial fits',async({page})=>{
 await setup(page);await page.locator('#tripOpenBtn').tap();await page.waitForTimeout(200);
 await page.evaluate(()=>window.__pushGps(43.95,11.06));
 await page.waitForTimeout(600);
 const offset=await page.evaluate(()=>{const m=window.__carburantiTripMap,p=m.latLngToContainerPoint([43.95,11.06]),s=m.getSize();return Math.hypot(p.x-s.x/2,p.y-s.y/2);});
 expect(offset).toBeLessThan(2);
 await expect(page.locator('#tripMap .trip-user-location')).toHaveCount(1);
});
test('permission revocation stops tracking and does not start a new watch on resume',async({page})=>{
 await setup(page);await page.evaluate(()=>window.__denyGps());
 expect(await page.evaluate(()=>window.CarburantiApp.state.locationWatchId)).toBeNull();
 const count=await page.evaluate(()=>window.__watchStats.started);
 await page.evaluate(()=>{window.CarburantiApp.state.lastLocationAt=Date.now()-180000;document.dispatchEvent(new Event('visibilitychange'));});
 expect(await page.evaluate(()=>window.__watchStats.started)).toBe(count);
});
