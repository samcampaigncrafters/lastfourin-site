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
  let pendingHub=null,motionRevision=0;
  function apply(direction,panel=null,hub=null){
    motionRevision++;root.dataset.tabMotion=direction;root.dataset.tabMotionLast=direction;root.dataset.tabMotionUsed='pending';
    if(['games','daily'].includes(panel)){root.dataset.tabPanel=panel;root.dataset.tabPanelLast=panel;pendingHub=panel==='games'?hub:null;}else delete root.dataset.tabPanel;
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
    if(!pendingHub)return;const row=document.getElementById('playSections');
    if(row&&Number.isFinite(pendingHub.rowTop))window.scrollTo({top:Math.max(0,window.scrollY+row.getBoundingClientRect().top-pendingHub.rowTop),left:0,behavior:'instant'});
    pendingHub=null;
  }
  function measureHub(){const row=document.getElementById('playSections');return row?{rowTop:row.getBoundingClientRect().top}:null;}
  restore();
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||reduce())return;
    const a=event.target.closest?.('a[href]');if(a?.closest('#playSections')?.dataset.localTabs==='true')return;if(!a||a.download||a.target&&a.target!=='_self')return;
    const to=new URL(a.href,location.href);if(!local(to)||path(to)===path(new URL(location.href)))return;
    const group=a.closest('.bubble-tabs,.nav-links,.nav-lg-in,.daily-links,#playSections,.daily-unified-tabs');
    const links=group?[...group.querySelectorAll('a[href]')]:[],current=links.findIndex(link=>link.hasAttribute('aria-current')||link.classList.contains('on')||path(new URL(link.href,location.href))===path(new URL(location.href)));
    const direction=current>=0&&links.indexOf(a)<current?'back':'forward',panel=group?.classList?.contains('daily-unified-tabs')?'daily':group?.id==='playSections'&&isHub(to)?'games':null;
    remember(to,direction,panel,panel?measureHub():null);
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
    alignCategory();if(event.viewTransition&&root.dataset.tabMotion){
      if(reduce())event.viewTransition.skipTransition();else{root.dataset.tabMotionUsed='view-transition';event.viewTransition.ready?.then(()=>{root.dataset.motionReady='yes';},error=>{root.dataset.motionReady=error.name+': '+error.message;});const revision=motionRevision;event.viewTransition.finished.then(()=>settleMotion(revision),()=>settleMotion(revision));}
    }
  });
  window.addEventListener('pageshow',event=>{if(event.persisted){clearMotion();restore();}alignCategory();});
})();

/* Small content changes slide into place after an action; clocks and background updates stay still. */
(function(){
  'use strict';
  const root=document.documentElement,reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let armedUntil=0,frame=0;const queued=new Set(),running=new WeakMap();
  const frameSelector='header,footer,.bubble-tabs,.nav,.nav-leagues,.toast';
  const panelSelector='.dlg,.player-dialog,.dialog-body,.dlg-body,.dd-panel,.mmenu,.menu,main .card,main .app-catalog,main .app-section,main #dailyGame,main #body,main #coinApp';
  function arm(event){
    if(reduced()||event.defaultPrevented||event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
    const control=event.target.closest?.('button,summary,select,input[type="checkbox"],input[type="radio"],[role="button"]');
    if(control&&!control.closest(frameSelector))armedUntil=Date.now()+1200;
  }
  document.addEventListener('click',arm,true);document.addEventListener('change',arm,true);document.addEventListener('keydown',arm,true);
  function queue(element){
    if(!element||element.closest(frameSelector)||element.closest('#scoresApp')||!element.getClientRects().length)return;
    const panel=element.closest(panelSelector)||(element.closest('main')?element:null);if(!panel||panel===document.body)return;
    queued.add(panel);if(!frame)frame=requestAnimationFrame(slide);
  }
  function slide(){
    frame=0;const candidates=[...queued];queued.clear();
    if(reduced()||root.dataset.tabMotion)return;
    for(const panel of candidates){
      if(!panel.isConnected||!panel.getClientRects().length||candidates.some(parent=>parent!==panel&&parent.contains(panel)))continue;
      running.get(panel)?.cancel();
      const base=getComputedStyle(panel).transform;
      const animation=panel.animate([{transform:'translateY(10px)'+(base==='none'?'':' '+base)},{transform:base}],{duration:180,easing:'cubic-bezier(.22,.8,.25,1)'});
      running.set(panel,animation);root.dataset.surfaceMotion='slide';
    }
    armedUntil=0;
  }
  function observe(){
    new MutationObserver(records=>{
      if(Date.now()>armedUntil||reduced()||root.dataset.tabMotion)return;
      const active=document.activeElement;if(active?.matches('textarea,input:not([type="checkbox"]):not([type="radio"])'))return;
      for(const record of records){
        if(record.type==='attributes'){
          if(record.attributeName==='hidden'){const library=record.target.closest('#app-game-library');if(library)queue(library);else if(!record.target.hidden)queue(record.target);}
          if(record.attributeName==='open'&&record.target.open)queue(record.target.querySelector(':scope > :not(summary)'));
          if(record.attributeName==='class'&&record.target.matches('.reveal,.dlg,.menu,.dd-panel,.mmenu'))queue(record.target);
        }else if([...record.addedNodes].some(node=>node.nodeType===1))queue(record.target);
      }
    }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open','class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();
