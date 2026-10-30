/* Scoreboard UI. Poll timing is not a promise of upstream feed latency. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.BubbleScores=api;api.mount();}})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const leagues={nfl:['NFL','football/nfl'],cfb:['NCAAF','football/college-football'],nba:['NBA','basketball/nba'],nhl:['NHL','hockey/nhl'],cbb:['NCAAB','basketball/mens-college-basketball'],mlb:['MLB','baseball/mlb']};
 function parse(data){
  if(!data||!Array.isArray(data.events))throw Error('Scores are temporarily unavailable.');
  return data.events.map(e=>{
   const c=e.competitions?.[0],t=e.status?.type||c?.status?.type||{},home=c?.competitors?.find(x=>x.homeAway==='home'),away=c?.competitors?.find(x=>x.homeAway==='away');
   if(!home||!away)return null;
   const side=x=>({name:x.team?.displayName||x.team?.abbreviation||'Team',abbr:x.team?.abbreviation||'',color:x.team?.color,score:x.score==null||x.score===''?null:Number(x.score)});
   return {id:String(e.id),date:e.date,home:side(home),away:side(away),state:t.state==='in'?'live':t.completed?'final':t.state==='pre'?'upcoming':'other',detail:t.shortDetail||t.detail||t.description||'Status unavailable'};
  }).filter(Boolean).sort((a,b)=>(a.state==='live'?-1:0)-(b.state==='live'?-1:0)||new Date(a.date)-new Date(b.date));
 }
 function url(league,day){if(!leagues[league]||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Choose a league and date.');return `https://site.api.espn.com/apis/site/v2/sports/${leagues[league][1]}/scoreboard?dates=${day.replace(/-/g,'')}&limit=400`;}
 function card(g,esc){
  const score=t=>g.state==='upcoming'?'—':Number.isFinite(t.score)?t.score:'—';
  const badge=t=>typeof LFI!=='undefined'&&LFI.scoreMark?LFI.scoreMark(t.abbr,'','s',t.color):'';
  const link='https://www.espn.com/'+(g.id.match(/^\d+$/)?'game/_/gameId/'+g.id:'');
  return `<article class="score-card" data-score-state="${g.state}"><div class="score-state ${g.state}">${g.state==='live'?'● Live · ':''}${esc(g.detail)}</div><div class="score-team">${badge(g.away)}<b>${esc(g.away.name)}</b><strong>${score(g.away)}</strong></div><div class="score-team">${badge(g.home)}<b>${esc(g.home.name)}</b><strong>${score(g.home)}</strong></div><a href="${link}" target="_blank" rel="noopener noreferrer" aria-label="${esc(g.away.name)} at ${esc(g.home.name)} game details on ESPN">Game details ↗</a></article>`;
 }
 function mount(){
  if(typeof document==='undefined'||!window.LFI)return;
  let el=document.getElementById('scoresApp');const home=location.pathname==='/';
  if(!el&&!home)return;
  if(!el){el=document.createElement('section');el.id='scoresApp';el.className='home-scores';document.querySelector('main')?.before(el);}
  if(el.dataset.mounted)return;el.dataset.mounted='true';
  const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/scores.css?v=20261029.circles1';document.head.appendChild(css);
  const esc=LFI.esc,today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date());
  let league='nfl',day=today(),filter='all',games=[],timer=null,busy=false,queued=false,revision=0,lastGood=null,disposed=false;
  el.innerHTML=`<div class="scores-heading"><div>${home?'<h2 class="disp">Scores</h2>':''}<p class="score-provider">ESPN feed · live scores update automatically every 10 seconds</p></div>${home?'<a class="btn" href="/scores/">All scores →</a>':''}</div><div class="scores-tools"><label>League <select id="scoreLeague">${Object.entries(leagues).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('')}</select></label>${home?'':`<label>Date <input id="scoreDate" type="date" value="${day}"></label><label>Show <select id="scoreFilter"><option value="all">All games</option><option value="live">Live</option><option value="upcoming">Upcoming</option><option value="final">Final</option></select></label>`}<span class="scores-status" role="status" aria-live="polite">Loading scores…</span></div><div class="scores-grid" aria-label="Game scores"></div>`;
  const grid=el.querySelector('.scores-grid'),status=el.querySelector('.scores-status');
  function render(){const selected=games.filter(g=>filter==='all'||g.state===filter),show=home?selected.slice(0,6):selected;grid.innerHTML=show.length?show.map(g=>card(g,esc)).join(''):`<p class="score-empty">No ${filter==='all'?'':esc(filter)+' '}games on ${esc(day)}. ${home?'Open all scores to choose another date.':'Try another date or league.'}</p>`;}
  function schedule(){clearTimeout(timer);if(!disposed&&!document.hidden)timer=setTimeout(refresh,games.some(g=>g.state==='live')?10000:60000);}
  async function refresh(){
   if(disposed||document.hidden)return;
   if(home&&day!==today()){day=today();revision++;games=[];lastGood=null;grid.innerHTML='<p>Loading today’s scores…</p>';}
   if(busy){queued=true;return;}busy=true;const rev=revision;const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),12000);
   status.textContent='Updating scores…';
   try{const response=await fetch(url(league,day),{signal:ctl.signal,cache:'no-cache'});if(!response.ok)throw Error('Scores are temporarily unavailable.');const next=parse(await response.json());if(rev!==revision||disposed)return;games=next;lastGood=new Date();render();status.textContent=`Checked ${lastGood.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',timeZone:'America/Chicago'})} CT`;}
   catch(e){if(rev===revision&&!disposed){status.textContent=lastGood?'Connection interrupted. Showing the last received scores.':'Scores unavailable. Retrying automatically.';if(!lastGood)grid.innerHTML='<p class="score-empty">The score feed could not be reached.</p>';}}
   finally{clearTimeout(timeout);busy=false;if(!disposed){if(queued){queued=false;refresh();}else schedule();}}
  }
  function change(){revision++;games=[];lastGood=null;grid.innerHTML='<p>Loading scores…</p>';clearTimeout(timer);refresh();}
  el.querySelector('#scoreLeague').onchange=e=>{league=e.target.value;if(home)day=today();change();};
  if(!home){el.querySelector('#scoreDate').onchange=e=>{if(!e.target.value)return;day=e.target.value;change();};el.querySelector('#scoreFilter').onchange=e=>{filter=e.target.value;render();};}
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden){if(home&&day!==today()){day=today();change();}else refresh();}});
  window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(timer);});
  window.addEventListener('pageshow',e=>{if(e.persisted){disposed=false;refresh();}});
  refresh();
 }
 return {parse,url,card,mount};
});
