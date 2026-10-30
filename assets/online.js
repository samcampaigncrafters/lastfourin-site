/* Public ranked play: private friend rooms continue through the existing game API. */
(function(){
 'use strict';if(!window.LFI||LFI.online)return;LFI.online={};
 const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/online.css?v=20261029-online2';document.head.appendChild(css);
 const esc=LFI.esc,details={names:['Name Them All Race','/trivia/race.html','Two players, a random list, and one shared clock. Most names claimed wins; equal scores are a draw.'],grid:['Grid Race','/grid/?opponent=friend','Twenty-five random clues, five minutes. Most squares claimed wins; equal scores are a draw.'],draft:['NFL Draft','/drafts/?opponent=friend','Draft any five players, best-season PPR scoring. Higher total wins. Fifteen-minute match limit; first pick is random.']};
 const errorText=e=>/function|schema cache|PGRST202|Something went wrong/i.test(e.message)?'Online ranked play is not available on this server yet.':e.message;
 const tier=m=>m.games<5?`Provisional · ${5-m.games} placement games left`:m.rating<1000?'Bronze':m.rating<1200?'Silver':m.rating<1400?'Gold':m.rating<1600?'Platinum':'Diamond';
 let badgeGame=null,badgeTimer=null,badgeBusy=false;
 async function badgePoll(){
  clearTimeout(badgeTimer);if(!badgeGame||document.hidden||badgeBusy)return;badgeBusy=true;let again=true;
  try{
   const s=await LFI.games.onlineState(badgeGame),box=document.getElementById('onlineMatch');if(!box)return;
   if(s.state==='done'){
    const r=s.result,host=s.uid===r.host,before=host?r.host_before:r.guest_before,after=host?r.host_after:r.guest_after;
    box.querySelector('b').textContent=`Ranked · ${!r.winner?'Draw':r.winner===s.uid?'Win':'Loss'} · ${before} → ${after}${r.reason==='forfeit'?' · forfeit':''}`;again=false;
   }else if(s.state==='matched'){box.querySelector('b').textContent='Ranked match · stay in the game';}else if(['void','expired'].includes(s.state)){box.querySelector('b').textContent='Online match closed · no rating change';again=false;}
  }catch(e){const b=document.querySelector('#onlineMatch b');if(b)b.textContent='Ranked · reconnecting…';}
  finally{badgeBusy=false;if(again&&badgeGame)badgeTimer=setTimeout(badgePoll,5000);}
 }
 document.addEventListener('bubble:game',e=>{
  const g=e.detail;if(!g?.settings?.onlineRanked||badgeGame===g.id)return;badgeGame=g.id;
  const main=document.querySelector('main');if(!main)return;const box=document.createElement('div');box.id='onlineMatch';box.className='online-match';box.setAttribute('data-free','');box.innerHTML=`<b>Ranked match · stay in the game</b><a href="/play/online/?kind=${g.kind}">Rankings</a>`;main.prepend(box);badgePoll();
 });
 const app=document.getElementById('onlineApp');if(!app){document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(badgeTimer);else badgePoll();});window.addEventListener('pagehide',()=>{badgeGame=null;clearTimeout(badgeTimer);});return;}
 let kind=new URLSearchParams(location.search).get('kind');if(!details[kind])kind='names';
 let timer=null,search=null,busy=false,cancelRequested=false,version=0,stopped=false;
 app.innerHTML=`<div class="online-layout"><section class="card online-card"><div class="kicker">Online · ranked</div><h2 class="disp">Find a match</h2><label for="onlineKind">Game</label><select id="onlineKind">${Object.entries(details).map(([k,d])=>`<option value="${k}">${d[0]}</option>`).join('')}</select><p id="onlineRules" class="online-note"></p><div class="online-rating" id="onlineRating">1000</div><div id="onlineTier" class="online-tier">Provisional</div><p id="onlineRecord"></p><div class="online-actions"><button class="btn gold big" id="onlineFind">Find opponent</button><button class="btn" id="onlineCancel" hidden>Cancel search</button><a class="btn" id="onlineFriend">Play a friend</a></div><p id="onlineStatus" class="online-status" role="status">Choose a game to find an opponent.</p><p class="online-note">Online games use standard rules. Each game has its own rating, starting at 1000; the first five results are provisional. Leaving a match counts as a loss. You forfeit after 90 seconds without contact if the other player is still connected. If both players lose contact, the match closes without rating changes. Private friend games are unranked.</p></section><section class="card online-card"><div class="kicker">Top players</div><h2 class="disp">Leaderboard</h2><div id="onlineBoard">Loading rankings…</div></section></div>`;
 const $=id=>document.getElementById(id),status=text=>{$('onlineStatus').textContent=text;};
 function controls(){ $('onlineKind').disabled=busy||!!search;$('onlineFind').disabled=busy||!!search;$('onlineCancel').hidden=!busy&&!search;$('onlineCancel').disabled=cancelRequested;}
 function stopSearch(){clearTimeout(timer);search=null;busy=false;cancelRequested=false;controls();}
 function enter(s){stopSearch();stopped=true;status('Opponent found. Opening your match…');location.assign(LFI.games.link(s.kind,s.code));}
 async function board(){const rev=++version;try{const b=await LFI.games.onlineBoard(kind);if(rev!==version||stopped)return;$('onlineRating').textContent=b.me.rating;$('onlineTier').textContent=tier(b.me);$('onlineRecord').textContent=`${b.me.wins} ${b.me.wins === 1 ? "win" : "wins"} · ${b.me.losses} ${b.me.losses === 1 ? "loss" : "losses"} · ${b.me.draws} ${b.me.draws === 1 ? "draw" : "draws"}`;$('onlineBoard').innerHTML=b.players.length?`<ol class="online-board">${b.players.map(p=>`<li><span>${p.rank}</span><div><strong>${esc(p.name)}</strong><small>@${esc(p.handle)} · ${p.wins}W ${p.losses}L ${p.draws}D${p.games<5?' · provisional':''}</small></div><b>${p.rating}</b></li>`).join('')}</ol>`:'<p>No completed ranked games yet. Be one of the first.</p>';}catch(e){if(rev===version)$('onlineBoard').textContent=errorText(e);}}
 function paint(){ $('onlineKind').value=kind;$('onlineRules').textContent=details[kind][2];$('onlineFriend').href=details[kind][1];board();}
 async function handle(s){
  if(s.state==='matched'){enter(s);return;}
  if(s.state==='waiting'){
   search=s.id;
   if(cancelRequested){const c=await LFI.games.onlineCancel(search);if(c.state==='matched'){enter(c);return;}stopSearch();status('Search cancelled.');return;}
   busy=false;controls();status('Looking for another player… Keep this tab open. No opponent has joined yet.');schedule();return;
  }
  stopSearch();status(s.state==='done'?'That match has finished. Find another opponent.':'Search ended. You can try again.');board();
 }
 function schedule(){clearTimeout(timer);if(!stopped&&!document.hidden&&search)timer=setTimeout(poll,3000);}
 async function poll(){if(stopped||document.hidden||busy||!search)return;busy=true;try{await handle(await LFI.games.onlineState());}catch(e){status('Connection interrupted. Reconnecting to your search…');busy=false;controls();schedule();}}
 $('onlineFind').onclick=async()=>{if(busy||search)return;const me=await LFI.games.me();if(!me){location.assign(LFI.games.signInUrl());return;}if(busy||search||stopped)return;busy=true;cancelRequested=false;controls();status('Starting your search…');try{await handle(await LFI.games.onlineFind(kind));}catch(e){stopSearch();status(errorText(e));}};
 $('onlineCancel').onclick=async()=>{if(cancelRequested)return;cancelRequested=true;controls();if(busy)return;busy=true;try{const s=await LFI.games.onlineCancel(search);if(s.state==='matched')enter(s);else{stopSearch();status('Search cancelled.');}}catch(e){busy=false;cancelRequested=false;controls();status(errorText(e));schedule();}};
 $('onlineKind').onchange=e=>{kind=e.target.value;paint();};
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)poll();});
 window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);clearTimeout(badgeTimer);});
 paint();controls();
})();
