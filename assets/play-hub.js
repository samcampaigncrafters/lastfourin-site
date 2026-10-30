(function(){
  'use strict';
  let key=document.body.dataset.playHub;const groups=LFI.playCategories,group=groups.find(g=>g.key===key),esc=LFI.esc;
  if(!group)return;
  const icons={trivia:'daily-five',rareair:'rare-air',playerguess:'player-guess',dailynine:'daily-nine',names:'name-them-all',pindrop:'pin-drop',grid:'grid-race',race:'names-race',nfl:'nfl-pickem',cfb:'college-pickem',nba:'nba-pickem',nhl:'nhl-pickem',cbb:'college-hoops',mlb:'mlb-pickem',pools:'pickem-pools',money:'thousand-challenge',ap:'ap-poll',bracket:'cfp-bracket',challenges:'challenges',drafts:'drafts',jerseys:'jersey-draft',coaches:'coaches-draft',redraft:'draft-classes',league:'league-redraft',online:'online-ranked',friend:'challenges'};
  const mark=(id,i)=>icons[id]?`<img class="play-game-icon" src="/assets/game-icons/${icons[id]}.svg?v=20261030.natural1" alt="" width="72" height="72">`:`<span class="play-number">${String(i+1).padStart(2,'0')}</span>`;
  const meta={"triviahub":{"title":"Trivia","intro":"Your whole trivia lineup. Daily challenges, deep cuts, and races with friends."},"pickemhub":{"title":"Pick\u2019em","intro":"Pick winners, predict the rankings, or build your bracket. Choose your game."},"multiplayerhub":{"title":"Multiplayer","intro":"Find a rival online, or invite a friend to your own private game."},"draftshub":{"title":"Drafts","intro":"NFL history, jersey numbers, coaches, and rookie classes. Build your board."}};
  const sections=document.getElementById('playSections'),cards=document.getElementById('gameCards'),root=document.documentElement;
  sections.innerHTML=groups.map(g=>`<a href="${g.href}" ${g.key===key?'aria-current="page"':''}>${esc(g.label)}</a>`).join('');
  sections.dataset.localTabs='true';
  let active=null,revision=0;
  function paint(next,push,anchor=sections.getBoundingClientRect().top){
    const rowTop=anchor;
    key=next.key;document.body.dataset.playHub=key;
    document.querySelector('header.nav').dataset.active=key;
    for(const a of sections.querySelectorAll('a')){if(a.getAttribute('href')===next.href)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
    for(const a of document.querySelectorAll('.nav-links .nav-home'))a.classList.toggle('on',a.getAttribute('href')===next.href);
    document.querySelector('.play-heading h1').textContent=meta[key].title;
    document.querySelector('.play-heading p').textContent=meta[key].intro;
    document.getElementById('gameCount').textContent=next.items.length+' ways to play';
    cards.setAttribute('aria-label',meta[key].title+' games');
    cards.innerHTML=next.items.map(([id,url,title,sub],i)=>`<a class="play-card" href="${url}"><div class="play-card-top">${mark(id,i)}<span class="play-arrow" aria-hidden="true">↗</span></div><h2>${esc(title)}</h2><p>${esc(sub)}</p><span class="play-cta">Let's play <span aria-hidden="true">→</span></span></a>`).join('');
    document.title=meta[key].title+' · PlayBubble';
    if(push)history.pushState({...history.state,bubblePlayCategory:key},'',next.href);
    window.scrollTo({top:Math.max(0,window.scrollY+sections.getBoundingClientRect().top-rowTop),left:0,behavior:'instant'});
  }
  async function choose(next,push=true){
    if(!next||next.key===key)return;
    const ticket=++revision,previous=active;previous?.skipTransition();
    if(previous)await previous.updateCallbackDone.catch(()=>{});
    if(ticket!==revision)return;
    const direction=groups.findIndex(g=>g.key===next.key)<groups.findIndex(g=>g.key===key)?'back':'forward';
    if(!document.startViewTransition||matchMedia('(prefers-reduced-motion: reduce)').matches){paint(next,push);return;}
    root.dataset.tabMotion=direction;root.dataset.tabMotionLast=direction;root.dataset.tabPanel='games';root.dataset.tabPanelLast='games';root.dataset.tabMotionUsed='panel-transition';
    const anchor=sections.getBoundingClientRect().top;root.dataset.hubAnchor=String(anchor);
    const transition=document.startViewTransition(()=>paint(next,push,anchor));active=transition;transition.ready.then(()=>{root.dataset.motionReady='yes';},error=>{root.dataset.motionReady=error.name+': '+error.message;});
    const clear=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(ticket===revision){active=null;delete root.dataset.tabMotion;delete root.dataset.tabPanel;}}));
    transition.finished.then(clear,clear);
  }
  sections.addEventListener('click',event=>{
    const a=event.target.closest('a[href]');if(!a||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const next=groups.find(g=>g.href===a.getAttribute('href'));if(next){event.preventDefault();choose(next);}
  });
  window.addEventListener('popstate',()=>choose(groups.find(g=>g.href===location.pathname),false));
  paint(group,false);
})();
