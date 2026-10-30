/* Light or dark, chosen before the page paints so it never flashes the wrong one.
   The player's own pick (the sun/moon switch, saved in this browser) wins; otherwise the phone or computer's setting. */
(function () {
  let t = null;
  try { t = localStorage.getItem("lfi-theme"); } catch (e) {}
  if (t !== "light" && t !== "dark") t = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = t;
})();

/* Real documents slide normally; category switches move only the game cards. */
(function(){
  'use strict';
  const root=document.documentElement,KEY='bubble-tab-motion-v1',reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const local=u=>u.protocol===location.protocol&&u.host===location.host,path=u=>u.pathname+u.search;
  const isHub=u=>/^\/play\/(trivia|pickem|multiplayer|drafts)\/$/.test(u.pathname);
  let pendingHub=null,motionRevision=0,indicatorStart=null;
  function apply(direction,panel=null,hub=null){
    motionRevision++;root.dataset.tabMotion=direction;root.dataset.tabMotionLast=direction;root.dataset.tabMotionUsed='pending';
    if(['games','daily'].includes(panel)){root.dataset.tabPanel=panel;root.dataset.tabPanelLast=panel;pendingHub=hub;indicatorStart=hub?.indicator||null;}else delete root.dataset.tabPanel;
  }
  function remember(to,direction,panel=null,hub=null){
    apply(direction,panel,hub);
    try{sessionStorage.setItem(KEY,JSON.stringify({to:path(to),direction,panel,hub,at:Date.now()}));}catch{}
  }
  function restore(){
    try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'null');sessionStorage.removeItem(KEY);
      if(!reduce()&&saved&&saved.to===path(new URL(location.href))&&Date.now()-saved.at>=0&&Date.now()-saved.at<10000&&['forward','back'].includes(saved.direction))apply(saved.direction,saved.panel,saved.hub);
    }catch{}
  }
  function alignCategory(){
    if(!pendingHub)return;const row=pendingHub.selector?document.querySelector(pendingHub.selector):document.getElementById('playSections');
    if(row&&Number.isFinite(pendingHub.rowTop))window.scrollTo({top:Math.max(0,window.scrollY+row.getBoundingClientRect().top-pendingHub.rowTop),left:0,behavior:'instant'});
    pendingHub=null;
  }
  function measureHub(){const row=document.getElementById('playSections');return row?{rowTop:row.getBoundingClientRect().top}:null;}
  restore();
  function indicators(){
    for(const row of document.querySelectorAll('.daily-unified-tabs,.tabs.modes')){
      const active=row.querySelector('a.on,a[aria-current]');if(!active)continue;
      const marker=document.createElement('span');marker.className='daily-slider';marker.setAttribute('aria-hidden','true');
      const align=()=>{const selected=row.querySelector('a.on,a[aria-current]');if(!selected)return null;const rr=row.getBoundingClientRect(),a=selected.getBoundingClientRect();const box={left:a.left-rr.left-row.clientLeft,top:a.top-rr.top-row.clientTop,width:a.width,height:a.height};Object.assign(marker.style,Object.fromEntries(Object.entries(box).map(([k,v])=>[k,v+'px'])));return box;};
      row.prepend(marker);const end=align();row.classList.add('has-slider');
      // Wrapping and web-font loading change the active tab's bounds.
      if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(align);observer.observe(row);for(const link of row.querySelectorAll('a'))observer.observe(link);}
      window.addEventListener('pageshow',align);
      if(indicatorStart&&row.matches(indicatorStart.selector)&&!reduce())marker.animate([{transform:`translate(${indicatorStart.left-end.left}px,${indicatorStart.top-end.top}px) scale(${indicatorStart.width/end.width},${indicatorStart.height/end.height})`},{transform:'none'}],{duration:280,easing:'cubic-bezier(.22,.8,.25,1)'});
    }
    indicatorStart=null;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',indicators,{once:true});else indicators();

  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||reduce())return;
    const a=event.target.closest?.('a[href]');if(a?.closest('#playSections')?.dataset.localTabs==='true')return;if(!a||a.download||a.target&&a.target!=='_self')return;
    const to=new URL(a.href,location.href);if(!local(to)||path(to)===path(new URL(location.href)))return;
    const modeGroup=to.pathname===location.pathname?document.querySelector('.tabs.modes'):null;
    const group=a.closest('.bubble-tabs,.nav-links,.nav-lg-in,.daily-links,#playSections,.daily-unified-tabs,.tabs.modes')||modeGroup;
    const links=group?[...group.querySelectorAll('a[href]')]:[],current=links.findIndex(link=>link.hasAttribute('aria-current')||link.classList.contains('on')||path(new URL(link.href,location.href))===path(new URL(location.href)));
    const target=links.indexOf(a)>=0?links.indexOf(a):links.findIndex(link=>path(new URL(link.href,location.href))===path(to));
    const direction=current>=0&&target>=0&&target<current?'back':'forward',mode=group?.classList?.contains('modes'),panel=mode||group?.classList?.contains('daily-unified-tabs')?'daily':group?.id==='playSections'&&isHub(to)?'games':null;
    const rowSelector=mode?'.tabs.modes':group?.classList?.contains('daily-unified-tabs')?'.daily-unified-tabs':null;
    const active=group?.querySelector('a.on,a[aria-current]'),gr=group?.getBoundingClientRect(),ar=active?.getBoundingClientRect();
    remember(to,direction,panel,rowSelector?{selector:rowSelector,rowTop:gr.top,indicator:ar?{selector:rowSelector,left:ar.left-gr.left-group.clientLeft,top:ar.top-gr.top-group.clientTop,width:ar.width,height:ar.height}:null}:panel?measureHub():null);
  },true);
  const clearMotion=()=>{delete root.dataset.tabMotion;delete root.dataset.tabPanel;pendingHub=null;};
  const settleMotion=(revision)=>{requestAnimationFrame(()=>requestAnimationFrame(()=>{if(revision===motionRevision)clearMotion();}));};
  window.addEventListener('pageswap',event=>{
    if(!event.viewTransition||reduce())return;const activation=event.activation;
    if(activation?.entry?.url){const to=new URL(activation.entry.url);if(local(to)&&path(to)!==path(new URL(location.href))){
      const direction=activation.navigationType==='traverse'?(activation.entry.index<activation.from?.index?'back':'forward'):(root.dataset.tabMotion||'forward');
      const panel=['games','daily'].includes(root.dataset.tabPanel)?root.dataset.tabPanel:null;
      remember(to,direction,panel,panel?(pendingHub||measureHub()):null);
    }}const revision=motionRevision;event.viewTransition.finished.then(()=>settleMotion(revision),()=>settleMotion(revision));
  });
  window.addEventListener('pagereveal',event=>{
    alignCategory();
    if(root.dataset.tabPanel==='daily'&&root.dataset.tabMotion){
      event.viewTransition?.skipTransition();root.dataset.tabMotionUsed='content-entry';root.dataset.motionReady='yes';
      const revision=motionRevision;setTimeout(()=>settleMotion(revision),320);return;
    }
    if(event.viewTransition&&root.dataset.tabMotion){
      if(reduce())event.viewTransition.skipTransition();else{root.dataset.tabMotionUsed='view-transition';event.viewTransition.ready?.then(()=>{root.dataset.motionReady='yes';},error=>{root.dataset.motionReady=error.name+': '+error.message;});const revision=motionRevision;event.viewTransition.finished.then(()=>settleMotion(revision),()=>settleMotion(revision));}
    }
  });
  window.addEventListener('pageshow',event=>{if(event.persisted){clearMotion();restore();}alignCategory();});
})();

/* Warm Pin Drop only from daily-game screens; data-saving connections opt out. */
(function(){
 if(navigator.connection?.saveData)return;
 const assets=[['/assets/vendor/globe.gl-2.46.2.min.js','script'],['/trivia/img/earth-4k.jpg','image']];let warmed=false;
 function warm(intent=false){
  if(location.pathname==='/trivia/pindrop.html')return;
  if(!warmed){warmed=true;for(const [href,as]of assets){const link=document.createElement('link');link.rel=intent?'preload':'prefetch';link.as=as;link.href=href;document.head.appendChild(link);}}
 }
 function init(){
  const link=document.querySelector('.daily-unified-tabs a[href="/trivia/pindrop.html"]');if(!link)return;
  for(const event of ['pointerenter','focus','pointerdown'])link.addEventListener(event,()=>warm(true),{once:true,passive:true});
  if('requestIdleCallback'in window)requestIdleCallback(()=>warm(),{timeout:2500});else setTimeout(()=>warm(),1200);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
