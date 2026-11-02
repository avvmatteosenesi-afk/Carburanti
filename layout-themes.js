(() => {
  'use strict';
  const KEY='carburanti:layout:v2';
  const layouts=[
    ['current','Classico','Attuale','#20c6ff','#ffe36b'],
    ['dragon','Dragon Ball','Goku in primo piano','#5fd7ff','#6b45ff'],
    ['arale','Arale & Dr. Slump','Arale in primo piano','#ff79c6','#72dcff'],
    ['daitarn','Daitarn III','Banjo Haran in primo piano','#0649a8','#ffcf24'],
    ['devilman','Devilman','Devilman in primo piano','#050608','#b00020'],
    ['jeeg','Jeeg Robot d’acciaio','Verde e acciaio','#087d45','#f0c52e'],
    ['harlock','Capitan Harlock','Harlock in primo piano','#071225','#81323b'],
    ['mazinga','Mazinga Z','Acciaio e rosso','#1d2835','#e33b2f'],
    ['goldrake','Goldrake','Cosmico blu','#092c73','#26a8df'],
    ['lamu','Lamù & Ataru','Lamù in primo piano','#ff72c7','#ffe23c'],
    ['kenshiro','Ken Shiro','Kenshiro in primo piano','#151a27','#d64532'],
    ['candy','Candy Candy','Fiori e rosa','#f6a6c8','#ffe4a8'],
    ['yattaman','Yattaman','Azione e cielo','#087bc1','#e33131'],
    ['lupin','Lupin III','Lupin in primo piano','#9d1717','#f1c43b'],
    ['oscar','Lady Oscar','Versailles','#a77b28','#f1d58b']
  ];
  function ensureStatsStyles(){if(document.querySelector('link[data-price-stats-fixed]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='price-stats-fixed.css?v=20261030-1';link.dataset.priceStatsFixed='1';document.head.appendChild(link)}
  function ensureArtworkOverrides(){
    if(document.getElementById('protagonist-art-overrides'))return;
    const style=document.createElement('style');
    style.id='protagonist-art-overrides';
    style.textContent=`
      body[data-layout="dragon"]{--theme-art:url("https://res.cloudinary.com/jerrick/image/upload/d_642250b563292b35f27461a7.png%2Cf_jpg%2Cfl_progressive%2Cq_auto%2Cw_1024/gdsufjvhsz32kpzbjjlm.png")!important;--theme-pos:left top!important;--theme-size:auto 245px!important}
      body[data-layout="arale"]{--theme-art:url("https://image.zeta-ai.io/profile-image/509e23b9-e14f-4ae5-88e6-faf11e202387/bec59632-7c81-4179-bd02-5827dbef5b9f.jpeg")!important;--theme-pos:left top!important;--theme-size:auto 245px!important}
      body[data-layout="daitarn"]{--theme-art:url("https://bibliomecha.altervista.org/pilots/images/Daitarn%203/banjo-haran-portrait-3.jpg")!important;--theme-pos:left top!important;--theme-size:auto 245px!important}
      body[data-layout="devilman"]{--theme-art:url("https://image.news.livedoor.com/newsimage/stf/7/0/70ea9_1839_db5b84aa3ef6361eb51fad672eab10bd.jpg")!important;--theme-pos:left top!important;--theme-size:auto 245px!important}
      body[data-layout="lamu"]{--theme-art:url("https://i.pinimg.com/736x/fd/ac/67/fdac673c3e95fd4193510d4a004d79df.jpg")!important;--theme-pos:left top!important;--theme-size:auto 245px!important}
      body[data-layout="kenshiro"]{--theme-art:url("https://images.everyeye.it/img-notizie/guida-all-anime-ken-guerriero-serie-cosa-parlano-v3-864715-1200x1200.webp")!important;--theme-pos:left top!important;--theme-size:auto 245px!important}
      body[data-layout="lupin"]{--theme-art:url("https://kk-promote-template.v3mh.com/answer-admin/prod/image/230301/PtsNF0pK7.png")!important;--theme-pos:left top!important;--theme-size:auto 245px!important}
      @media(max-width:420px){body[data-layout="dragon"],body[data-layout="arale"],body[data-layout="daitarn"],body[data-layout="devilman"],body[data-layout="lamu"],body[data-layout="kenshiro"],body[data-layout="lupin"]{--theme-size:auto 235px!important}}
    `;
    document.head.appendChild(style);
  }
  function valid(v){return layouts.some(x=>x[0]===v)?v:'current'}
  function apply(v){v=valid(v);if(v==='current')document.body.removeAttribute('data-layout');else document.body.dataset.layout=v;document.querySelectorAll('.layout-choice').forEach(b=>b.classList.toggle('is-selected',b.dataset.layout===v));setTimeout(()=>{window.dispatchEvent(new Event('resize'));if(window.__carburantiMap)window.__carburantiMap.invalidateSize();},80)}
  function saved(){try{return valid(localStorage.getItem(KEY)||localStorage.getItem('carburanti:layout:v1')||'current')}catch{return 'current'}}
  function init(){ensureStatsStyles();ensureArtworkOverrides();apply(saved());const sheet=document.querySelector('#settingsPanel .sheet');const save=document.getElementById('saveSettingsBtn');if(!sheet||!save)return;const wrap=document.createElement('div');wrap.innerHTML='<label class="field-label">Layout grafico</label><div class="layout-picker" role="radiogroup" aria-label="Layout grafico"></div><p class="sheet-help">15 layout completi. La mappa e tutte le funzioni restano identiche.</p>';const picker=wrap.querySelector('.layout-picker');layouts.forEach(([id,name,desc,a,b])=>{const btn=document.createElement('button');btn.type='button';btn.className='layout-choice';btn.dataset.layout=id;btn.innerHTML=`<span class="layout-swatch" style="--a:${a};--b:${b}"></span>${name}<small>${desc}</small>`;btn.addEventListener('click',()=>apply(id));picker.appendChild(btn)});save.before(...wrap.childNodes);apply(saved());save.addEventListener('click',()=>{const selected=document.querySelector('.layout-choice.is-selected');try{localStorage.setItem(KEY,selected?selected.dataset.layout:'current')}catch{}},{capture:true});const close=document.getElementById('settingsCloseBtn');if(close)close.addEventListener('click',()=>apply(saved()),{capture:true});const panel=document.getElementById('settingsPanel');if(panel)panel.addEventListener('click',e=>{if(e.target===panel)apply(saved())},{capture:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();