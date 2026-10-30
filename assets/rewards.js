/* Closed cosmetic coins. All balances, answers and purchases belong to the server. */
(function () {
  'use strict';
  if (!window.LFI || LFI.rewards) return;
  const esc=LFI.esc;
  const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/rewards.css?v=20261029.finish1';document.head.appendChild(css);
  let state=null,busy=false,accountId=null,accountRevision=0,initialized=false;const profiles=new Map();
  function bounded(task,label){
    let timer;return Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),12000)})]).finally(()=>clearTimeout(timer));
  }
  async function cloudReady(){
    for(let i=0;i<100&&!LFI.cloud;i++)await new Promise(r=>setTimeout(r,50));
    if(!LFI.cloud)throw Error('Account connection unavailable. Please refresh.');
    await bounded(LFI.cloud.ready,'Account connection is taking too long. Please try again.');return LFI.cloud;
  }
  async function rpc(name,args={}){
    const c=await cloudReady();
    if(!c.sb||!c.profile?.onboarded)throw Error('Sign in to earn coins and save your collection.');
    const {data,error}=await bounded(c.sb.rpc(name,args),'Your coins could not be loaded right now. Please try again.');
    if(error){
      if(/function|schema cache|PGRST202/i.test(error.message||''))throw Error('Coins are not available on this server yet.');
      throw Error(error.message||'Could not save that change. Please try again.');
    }
    return data;
  }
  function frame(el,style){if(!el)return;el.classList.remove('coin-frame-violet','coin-frame-gold','coin-frame-mint');if(['violet','gold','mint'].includes(style))el.classList.add('coin-frame-'+style);}
  function ownFrame(){const i=state?.catalog.find(i=>i.id===state.frame);frame(document.querySelector('header.nav .avatar'),i?.style);}
  async function decorate(){
    const el=document.querySelector('[data-coin-profile]');if(!el)return;
    const id=el.dataset.coinProfile;
    try{
      if(!profiles.has(id))profiles.set(id,cloudReady().then(c=>c.sb?.rpc('coins_profile',{p_user:id})).then(r=>r?.data||null));
      const p=await profiles.get(id);if(!p||el.dataset.coinProfile!==id)return;
      frame(el.querySelector('.prof-av'),p.frame);
      let title=el.querySelector('.coin-profile-title');
      if(p.title&&!title){title=document.createElement('p');title.className='coin-profile-title';el.querySelector('.handle')?.after(title);}
      if(title&&title.textContent!==(p.title||''))title.textContent=p.title||'';
    }catch(e){/* Cosmetic availability never blocks an existing profile. */}
  }
  LFI.rewards={load:()=>rpc('coins_state'),decorate};
  document.addEventListener('bubble:header',ownFrame);
  const prof=document.getElementById('prof');if(prof)new MutationObserver(decorate).observe(prof,{childList:true,subtree:true});
  function draw(){
    const el=document.getElementById('coinApp');if(!el||!state)return;
    const owned=new Set(state.inventory),done=state.questions.filter(q=>q.choice!==null).length;
    const identity=LFI.cloud?.profile||{};
    const title=state.catalog.find(i=>i.id===state.title)?.style||'Your next look starts here';
    el.innerHTML=`<div class="coin-top"><section class="coin-wallet card"><div class="kicker">Your coins</div><strong class="coin-balance">${state.balance.toLocaleString()}</strong><p>Earn them. Make it yours.</p><button class="btn gold" data-checkin ${state.checkedIn?'disabled':''}>${state.checkedIn?'✓ Daily coins claimed':'Claim 10 daily coins'}</button><small>Daily challenge resets at midnight Eastern.</small></section>
      <section class="coin-preview card"><div class="kicker">Your look</div><div class="coin-demo-avatar" id="coinPreviewAvatar">${esc((identity.display_name||identity.username||'B')[0].toUpperCase())}</div><h2>${esc(identity.display_name||identity.username||'Bubble fan')}</h2><p>${esc(title)}</p><div class="go-row"><button class="btn" data-clear="frame" ${state.frame?'':'disabled'}>Remove frame</button><button class="btn" data-clear="title" ${state.title?'':'disabled'}>Remove title</button></div><a href="/u/?h=${encodeURIComponent(identity.username||'')}">View my profile →</a></section></div>
      <details class="coin-challenge card" ${done<3?'open':''}><summary class="coin-section-head"><div><div class="kicker">Earn up to 40 coins</div><h2 class="disp">Daily three</h2></div><span>${done}/3 answered · ${done===3?'Review':'Play'}</span></summary><p>10 coins for each correct answer. Get all three for a 10-coin bonus. Your first answer is final.</p><div class="coin-questions">${state.questions.map((q,n)=>`<article><h3><span>${n+1}.</span> ${esc(q.prompt)}</h3><div class="coin-options">${q.choices.map((c,i)=>`<button class="btn ${q.choice===i?(q.correct?'coin-right':'coin-wrong'):''}" data-question="${q.id}" data-choice="${i}" ${q.choice!==null?'disabled':''}>${esc(c)}${q.choice===i?(q.correct?' ✓':' ✕'):''}</button>`).join('')}</div>${q.choice!==null?`<p class="coin-result">${q.correct?'+10 coins. ':'No coins this time. '}${esc(q.explanation)}</p>`:''}</article>`).join('')}</div></details>
      <section><div class="coin-section-head"><div><div class="kicker">Cosmetics only</div><h2 class="disp">The shop</h2></div></div><div class="coin-shop">${state.catalog.map(i=>{const has=owned.has(i.id),equipped=state[i.kind]===i.id;return `<article class="card"><div class="coin-product ${i.kind==='frame'?'coin-frame-'+esc(i.style):'coin-title-product'}">${i.kind==='frame'?'B':esc(i.style)}</div><h3>${esc(i.label)}</h3><p>${i.kind==='frame'?'Profile frame':'Profile title'} · ${i.price} coins</p><button class="btn ${has?'':'gold'}" ${equipped||(!has&&state.balance<i.price)?'disabled':''} ${has?`data-equip="${esc(i.id)}" data-kind="${i.kind}"`:`data-buy="${esc(i.id)}"`}>${equipped?'Equipped':has?'Equip':state.balance<i.price?`Need ${i.price-state.balance} more coins`:`Get for ${i.price} coins`}</button></article>`;}).join('')}</div></section>
      <section class="card coin-history"><h2 class="disp">Your activity</h2>${state.history.length?`<ol>${state.history.map(h=>`<li><span>${esc(h.label)}</span><b>${h.amount>0?'+':''}${h.amount}</b></li>`).join('')}</ol>`:'<p>Claim your daily coins to get started.</p>'}</section><p class="coin-fine">Coins stay on Bubble. No cash value, cash-out, transfers, prizes, or competitive advantages. Coin purchases are not enabled.</p>`;
    frame(document.getElementById('coinPreviewAvatar'),state.catalog.find(i=>i.id===state.frame)?.style);ownFrame();
  }
  function message(s){const el=document.getElementById('coinStatus');if(el)el.textContent=s;}
  async function change(name,args){
    if(busy)return;busy=true;const revision=accountRevision;const app=document.getElementById('coinApp');app?.setAttribute('aria-busy','true');
    try{const next=await rpc(name,args);if(revision!==accountRevision)return;state=next;draw();message('Saved.');}
    catch(e){if(revision===accountRevision)message(e.message);}
    finally{busy=false;app?.removeAttribute('aria-busy');}
  }
  document.getElementById('coinApp')?.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.hasAttribute('data-checkin'))change('coins_checkin');
    else if(b.dataset.question)change('coins_answer',{p_day:state.day,p_question:+b.dataset.question,p_choice:+b.dataset.choice});
    else if(b.dataset.buy)change('coins_buy',{p_item:b.dataset.buy});
    else if(b.dataset.equip)change('coins_equip',{p_kind:b.dataset.kind,p_item:b.dataset.equip});
    else if(b.dataset.clear)change('coins_equip',{p_kind:b.dataset.clear,p_item:null});
  });
  async function syncAccount(c){
    const id=c.profile?.onboarded?c.profile.id:null;
    if(initialized&&id===accountId)return;
    initialized=true;accountId=id;const revision=++accountRevision;
    state=null;ownFrame();decorate();
    const app=document.getElementById('coinApp');
    if(!id){if(app){app.innerHTML='<section class="card coin-signin"><h2 class="disp">Your collection starts here</h2><p>Make a free account to earn coins, save your collection, and customize your profile.</p><a class="btn gold" href="/signin/?next=%2Fcoins%2F">Sign in to get started</a></section>';message('');}return;}
    if(app){app.innerHTML='<p>Loading your coins…</p>';message('');}
    try{const next=await rpc('coins_state');if(revision!==accountRevision)return;state=next;draw();message('');decorate();}
    catch(e){if(revision!==accountRevision)return;if(app){app.innerHTML='<p><button class="btn" id="coinRetry">Try again</button></p>';document.getElementById('coinRetry').onclick=()=>location.reload();message(e.message);}}
  }
  (async()=>{
    try{const c=await cloudReady();if(c.onChange)c.onChange(syncAccount);await syncAccount(c);}
    catch(e){message(e.message);const app=document.getElementById('coinApp');if(app){app.innerHTML='<p><button class="btn" id="coinRetry">Try again</button></p>';document.getElementById('coinRetry').onclick=()=>location.reload();}}
  })();
})();
