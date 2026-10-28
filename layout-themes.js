(() => {
  'use strict';
  const KEY='carburanti:layout:v1';
  const layouts=[
    ['current','Attuale','Versione stabile','#20c6ff','#ffe36b'],
    ['dragon','Dragon','Arancio e blu','#ff8a00','#ffd43b'],
    ['arale','Arale','Rosa e azzurro','#ff79c6','#72dcff'],
    ['daitarn','Daitarn III','Blu mecha','#0649a8','#ffcf24'],
    ['devilman','Devilman','Nero e rosso','#050608','#b00020'],
    ['sasuke','Sasuke','Avventura vintage','#d9b16f','#8dcf9a'],
    ['harlock','Harlock','Spazio scuro','#071225','#81323b'],
    ['mazinga','Mazinga','Acciaio e rosso','#1d2835','#e33b2f'],
    ['goldrake','Goldrake','Cosmico viola','#24125d','#26a8df'],
    ['robot80','Robot anni 80','Giallo rétro','#f1b522','#e34a2f'],
    ['vintage','Vintage anime','Carta e verde','#d0aa6e','#7ea67e']
  ];
  function valid(v){return layouts.some(x=>x[0]===v)?v:'current'}
  function apply(v){v=valid(v);if(v==='current')document.body.removeAttribute('data-layout');else document.body.dataset.layout=v;document.querySelectorAll('.layout-choice').forEach(b=>b.classList.toggle('is-selected',b.dataset.layout===v));setTimeout(()=>{window.dispatchEvent(new Event('resize'));if(window.__carburantiMap)window.__carburantiMap.invalidateSize();},80)}
  function saved(){try{return valid(localStorage.getItem(KEY)||'current')}catch{return 'current'}}
  function init(){apply(saved());const sheet=document.querySelector('#settingsPanel .sheet');const save=document.getElementById('saveSettingsBtn');if(!sheet||!save)return;const wrap=document.createElement('div');wrap.innerHTML='<label class="field-label">Layout grafico</label><div class="layout-picker" role="radiogroup" aria-label="Layout grafico"></div><p class="sheet-help">Cambia solo l’aspetto: disposizione, mappa e funzioni restano invariate.</p>';const picker=wrap.querySelector('.layout-picker');layouts.forEach(([id,name,desc,a,b])=>{const btn=document.createElement('button');btn.type='button';btn.className='layout-choice';btn.dataset.layout=id;btn.innerHTML=`<span class="layout-swatch" style="--a:${a};--b:${b}"></span>${name}<small>${desc}</small>`;btn.addEventListener('click',()=>apply(id));picker.appendChild(btn)});save.before(...wrap.childNodes);apply(saved());save.addEventListener('click',()=>{const selected=document.querySelector('.layout-choice.is-selected');try{localStorage.setItem(KEY,selected?selected.dataset.layout:'current')}catch{}},{capture:true});const close=document.getElementById('settingsCloseBtn');if(close)close.addEventListener('click',()=>apply(saved()),{capture:true});const panel=document.getElementById('settingsPanel');if(panel)panel.addEventListener('click',e=>{if(e.target===panel)apply(saved())},{capture:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
