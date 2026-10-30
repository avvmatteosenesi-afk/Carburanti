(() => {
  'use strict';
  const KEY='carburanti:layout:v2';
  const layouts=[
    ['current','Classico','Attuale','#20c6ff','#ffe36b'],
    ['dragon','Dragon Ball','Goku in primo piano','#5fd7ff','#6b45ff'],
    ['arale','Arale & Dr. Slump','Arale in primo piano','#ff79c6','#72dcff'],
    ['daitarn','Daitarn III','Blu e oro','#0649a8','#ffcf24'],
    ['devilman','Devilman','Devilman in primo piano','#050608','#b00020'],
    ['jeeg','Jeeg Robot d’acciaio','Verde e acciaio','#087d45','#f0c52e'],
    ['harlock','Capitan Harlock','Harlock in primo piano','#071225','#81323b'],
    ['mazinga','Mazinga Z','Acciaio e rosso','#1d2835','#e33b2f'],
    ['goldrake','Goldrake','Cosmico blu','#092c73','#26a8df'],
    ['lamu','Lamù & Ataru','Scariche elettriche','#ff72c7','#ffe23c'],
    ['kenshiro','Ken Shiro','Hokuto','#151a27','#d64532'],
    ['candy','Candy Candy','Fiori e rosa','#f6a6c8','#ffe4a8'],
    ['yattaman','Yattaman','Azione e cielo','#087bc1','#e33131'],
    ['lupin','Lupin III','Rosso e notte','#9d1717','#f1c43b'],
    ['oscar','Lady Oscar','Versailles','#a77b28','#f1d58b']
  ];
  function ensureStatsStyles(){if(document.querySelector('link[data-price-stats-fixed]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='price-stats-fixed.css?v=20261030-1';link.dataset.priceStatsFixed='1';document.head.appendChild(link)}
  function valid(v){return layouts.some(x=>x[0]===v)?v:'current'}
  function apply(v){v=valid(v);if(v==='current')document.body.removeAttribute('data-layout');else document.body.dataset.layout=v;document.querySelectorAll('.layout-choice').forEach(b=>b.classList.toggle('is-selected',b.dataset.layout===v));setTimeout(()=>{window.dispatchEvent(new Event('resize'));if(window.__carburantiMap)window.__carburantiMap.invalidateSize();},80)}
  function saved(){try{return valid(localStorage.getItem(KEY)||localStorage.getItem('carburanti:layout:v1')||'current')}catch{return 'current'}}
  function init(){ensureStatsStyles();apply(saved());const sheet=document.querySelector('#settingsPanel .sheet');const save=document.getElementById('saveSettingsBtn');if(!sheet||!save)return;const wrap=document.createElement('div');wrap.innerHTML='<label class="field-label">Layout grafico</label><div class="layout-picker" role="radiogroup" aria-label="Layout grafico"></div><p class="sheet-help">15 layout completi. La mappa e tutte le funzioni restano identiche.</p>';const picker=wrap.querySelector('.layout-picker');layouts.forEach(([id,name,desc,a,b])=>{const btn=document.createElement('button');btn.type='button';btn.className='layout-choice';btn.dataset.layout=id;btn.innerHTML=`<span class="layout-swatch" style="--a:${a};--b:${b}"></span>${name}<small>${desc}</small>`;btn.addEventListener('click',()=>apply(id));picker.appendChild(btn)});save.before(...wrap.childNodes);apply(saved());save.addEventListener('click',()=>{const selected=document.querySelector('.layout-choice.is-selected');try{localStorage.setItem(KEY,selected?selected.dataset.layout:'current')}catch{}},{capture:true});const close=document.getElementById('settingsCloseBtn');if(close)close.addEventListener('click',()=>apply(saved()),{capture:true});const panel=document.getElementById('settingsPanel');if(panel)panel.addEventListener('click',e=>{if(e.target===panel)apply(saved())},{capture:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();