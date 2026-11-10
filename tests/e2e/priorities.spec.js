const {test,expect}=require('@playwright/test');
// Network fixtures must not be bypassed by the service worker's own fetches.
test.use({serviceWorkers:'block'});
const stations=[{id:'audit-stop',name:'Area test',brand:'Test',address:'Autostrada A11',city:'Pistoia',province:'PT',lat:43.89,lon:10.9,highway:true,prices:{benzina:{price:1.75,self:false,updated:'2026-11-10T08:00:00Z'}}}];
function payload(age=0){return {metadata:{generated_at:new Date(Date.now()-age*3600000).toISOString(),source_snapshot_date:new Date().toISOString().slice(0,10),source:'MIMIT test',source_mode:'mimit-osservaprezzi-live-api-v2',api_provinces:107},stations};}
async function setup(page,age=0){
 await page.addInitScript(()=>{localStorage.setItem('carburanti:geo-consent:v3','1');});
 await page.route('**/data/stations*.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload(age))}));
 await page.goto('./',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#dataStatus')).toContainText('acquisiti');
}
test('data details distinguish acquisition from price communication',async({page})=>{
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await setup(page);await page.locator('#dataStatus').tap();
 await expect(page.getByRole('dialog',{name:'Aggiornamento dati'})).toBeVisible();
 await expect(page.locator('#dataInfoAcquired')).not.toHaveText('non disponibile');
 await expect(page.locator('#dataInfoSource')).toHaveText('MIMIT test');
 expect(errors).toEqual([]);
 await page.getByRole('button',{name:'Chiudi informazioni dati'}).tap();
 await expect(page.locator('#dataInfoDialog')).toBeHidden();
});
test('old acquisition is warned even with a fresh snapshot date',async({page})=>{
 await setup(page,49);await expect(page.locator('#dataFreshnessNotice')).toBeVisible();
 await expect(page.locator('#dataFreshnessNotice')).toContainText('48 ore');
 await expect(page.locator('#dataStatus')).toHaveClass(/data-stale/);
});
test('geocoding failure restores a usable calculate button',async({page})=>{
 await page.route('**/search?**',route=>route.fulfill({status:503,body:'unavailable'}));
 await setup(page);await page.locator('#tripOpenBtn').tap();
 await page.locator('#tripFrom').fill('Agliana');await page.locator('#tripTo').fill('Lucca');
 await page.locator('#tripGoBtn').tap();
 await expect(page.locator('#tripMessage')).toContainText('non disponibile');
 await expect(page.locator('#tripGoBtn')).toBeEnabled();
});
test('closing a pending trip cancels it and allows reopening',async({page})=>{
 await page.route('**/search?**',()=>new Promise(()=>{}));
 await setup(page);await page.locator('#tripOpenBtn').tap();
 await page.locator('#tripFrom').fill('Agliana');await page.locator('#tripTo').fill('Lucca');
 await page.locator('#tripGoBtn').tap();await expect(page.locator('#tripGoBtn')).toBeDisabled();
 await page.locator('#tripCloseBtn').tap();await page.locator('#tripOpenBtn').tap();
 await expect(page.locator('#tripGoBtn')).toBeEnabled();await expect(page.locator('#tripSummary')).toBeHidden();
});
test('motorway popup includes sale mode and checks directional detour',async({page})=>{
 await page.route('**/search?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{lat:'43.89',lon:'10.9',display_name:'Pistoia',address:{city:'Pistoia'}}])}));
 await page.route('**/route/v1/driving/**',route=>{
  const url=new URL(route.request().url()),coords=[[11.0069,43.9022],[10.9,43.89],[10.75,43.87]];
  const stop=url.pathname.split(';').length===3;
  const result={distance:stop?18000:10000,duration:900,geometry:{coordinates:coords},legs:[{steps:[{name:'Autostrada A11',ref:'A11',distance:30000,geometry:{coordinates:coords},maneuver:{modifier:stop?'uturn':'straight'}}]}]};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({code:'Ok',routes:[result]})});
 });
 await setup(page);await page.locator('#tripOpenBtn').tap();
 await page.locator('#tripFrom').fill('Agliana');await page.locator('#tripTo').fill('Lucca');await page.locator('#tripGoBtn').tap();
 await expect(page.locator('#tripSummary')).toBeVisible();
 await page.evaluate(()=>{let opened=false;window.__carburantiTripMap.eachLayer(layer=>{if(!opened && layer.options?.pane==='tripStations'&&layer.getLatLng){opened=true;layer.fire('click');}});});
 await expect(page.locator('.trip-station-popup')).toBeVisible();
 await expect(page.locator('.trip-station-popup')).toContainText('Servito · prezzo comunicato:');
 await page.locator('.trip-access-check').tap();
 await expect(page.locator('.trip-access-result')).toContainText('inversione');
 await expect(page.locator('.trip-access-result')).toContainText('+8.0 km');
});
