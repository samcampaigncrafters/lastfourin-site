/* Public ranked play: private friend rooms continue through the existing game API. */
(function(){
 'use strict';if(!window.LFI||LFI.online)return;LFI.online={};
 const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/online.css?v=20261030-trophies2';document.head.appendChild(css);
 const esc=LFI.esc,details={names:['Name Them All Race','/trivia/race.html','Two players, a random list, and one shared clock. Most names wins. A tied score goes to a fresh sudden-death prompt.'],grid:['Grid Race','/grid/?opponent=friend','Twenty-five random clues, five minutes. Most squares wins. A tied score goes to one sudden-death clue.'],weekdraft:['Draft Battle','/play/draft-battle/?friend=1','Call the coin toss. Ten players per round, three picks each. Spin any regular-season week; non-players score zero. Pair-by-pair PPR reveal. First to two rounds wins.']};
 const errorText=e=>/function|schema cache|PGRST202|Something went wrong/i.test(e.message)?'Online ranked play is not available on this server yet.':e.message;
 const trophyRank=m=>m.worldRank?`${m.tied?'Tied ':''}#${Number(m.worldRank).toLocaleString()}`:'Unranked';
 let badgeGame=null,badgeTimer=null,badgeBusy=false;
 async function badgePoll(){
  clearTimeout(badgeTimer);if(!badgeGame||document.hidden||badgeBusy)return;badgeBusy=true;let again=true;
  try{
   const s=await LFI.games.onlineState(badgeGame),box=document.getElementById('onlineMatch');if(!box)return;
   if(s.state==='done'){
    const r=s.result,host=s.uid===r.host,before=host?r.host_trophies_before:r.guest_trophies_before,after=host?r.host_trophies_after:r.guest_trophies_after;
    box.querySelector('b').textContent=`Ranked · ${!r.winner?'Draw':r.winner===s.uid?'Win':'Loss'}${r.trophy_rule_version===2?` · 🏆 ${before} → ${after}`:' · historical result'}${r.reason==='forfeit'?' · forfeit':r.reason==='overtime'?' · overtime':''}`;again=false;
   }else if(s.state==='matched'){box.querySelector('b').textContent='Ranked match · stay in the game';}else if(['void','expired'].includes(s.state)){box.querySelector('b').textContent='Online match closed · no trophy change';again=false;}
  }catch(e){const b=document.querySelector('#onlineMatch b');if(b)b.textContent='Ranked · reconnecting…';}
  finally{badgeBusy=false;if(again&&badgeGame)badgeTimer=setTimeout(badgePoll,5000);}
 }
 document.addEventListener('bubble:game',e=>{
  const g=e.detail;syncOvertime(g);if(!g?.settings?.onlineRanked||badgeGame===g.id)return;badgeGame=g.id;
  const main=document.querySelector('main');if(!main)return;const box=document.createElement('div');box.id='onlineMatch';box.className='online-match';box.setAttribute('data-free','');box.innerHTML=`<b>Ranked match · stay in the game</b><a href="/play/online/?kind=${g.kind}">Rankings</a>`;main.prepend(box);badgePoll();
 });
 let overtime=null,overtimeSending=false;
 function syncOvertime(g){
  const state=g?.settings?.onlineRanked&&g.overtime;
  if(!state){if(overtime?.id===g?.id){document.getElementById('rankedOvertime')?.remove();overtime=null;}return;}
  if(overtime?.id===g.id&&overtime.revision===state.revision)return;
  overtime={...state,id:g.id,uid:g.uid};
  let dlg=document.getElementById('rankedOvertime');
  if(!dlg){dlg=document.createElement('dialog');dlg.id='rankedOvertime';dlg.className='online-overtime';dlg.setAttribute('aria-labelledby','overtimeTitle');dlg.addEventListener('cancel',e=>e.preventDefault());document.body.appendChild(dlg);}
  const draft=state.kind==='draft',mine=!draft||state.turn===g.uid;
  dlg.innerHTML=`<div class="kicker">Ranked · overtime ${state.round}</div><h2 class="disp" id="overtimeTitle">${draft?'Extra pick':'Sudden death'}</h2><p>${esc(state.prompt)}</p><p class="online-note">${draft?`${mine?'Your turn':'Opponent’s turn'} · 60 seconds per pick. Used players stay unavailable.`:'First correct answer wins. Both players receive the same fresh prompt.'}</p>${draft?`<p class="online-note">${(state.picks||[]).map(p=>`${p.user===g.uid?'You':'Opponent'} picked ${esc(p.item.split('|')[0])}`).join(' · ')}</p>`:''}<label for="overtimeAnswer">${draft?'Find your player':'Your answer'}</label><input id="overtimeAnswer" autocomplete="off" spellcheck="false" maxlength="150" placeholder="${draft?'Search by name':'Type a player’s name'}" ${mine?'':'disabled'}>${draft?'<div id="overtimeChoices" class="online-overtime-choices"></div>':'<button class="btn gold" id="overtimeSend">Submit answer</button>'}<p id="overtimeFeedback" role="status" aria-live="polite"></p><button class="btn" id="overtimeLeave">Leave and forfeit</button>`;
  const input=dlg.querySelector('#overtimeAnswer');
  async function submit(item=null){
   if(overtimeSending)return;const shot={...overtime},answer=input.value.trim();if(!draft&&!answer)return;
   overtimeSending=true;dlg.querySelector('#overtimeFeedback').textContent='Checking…';
   try{const r=await LFI.games.overtimeMove(shot.id,shot.round,item,draft?null:answer);
    if(document.getElementById('overtimeFeedback'))document.getElementById('overtimeFeedback').textContent=r.ok?'Accepted. Updating the match…':({wrong:'That answer does not fit. Try again.',turn:'It is your opponent’s turn.',taken:'That player was already picked.',round:'A new overtime round has started.',over:'This match has ended.'}[r.why]||'Try again.');
    await LFI.games.get(shot.id);
   }catch(e){if(document.getElementById('overtimeFeedback'))document.getElementById('overtimeFeedback').textContent=e.message;}
   finally{overtimeSending=false;}
  }
  if(draft){
   const render=()=>{const query=input.value.trim().toLowerCase();dlg.querySelector('#overtimeChoices').innerHTML=(state.choices||[]).filter(k=>!query||k.toLowerCase().includes(query)).slice(0,30).map(k=>{const [name,pos,year]=k.split('|');return `<button class="btn" data-pick="${esc(k)}" ${mine?'':'disabled'}>${esc(name)} <small>${esc(pos)} · ${esc(year)}</small></button>`}).join('');};
   input.oninput=render;dlg.querySelector('#overtimeChoices').onclick=e=>{const button=e.target.closest('[data-pick]');if(button)submit(button.dataset.pick);};render();
  }else{dlg.querySelector('#overtimeSend').onclick=()=>submit();input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit();}};}
  dlg.querySelector('#overtimeLeave').onclick=async()=>{if(!confirm('Leave overtime and forfeit this match?'))return;try{await LFI.games.leave(g.id);location.assign('/play/online/?kind='+state.kind);}catch(e){dlg.querySelector('#overtimeFeedback').textContent=e.message;}};
  if(!dlg.open)dlg.showModal();if(mine)input.focus({preventScroll:true});
 }

 const app=document.getElementById('onlineApp');if(!app){document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(badgeTimer);else badgePoll();});window.addEventListener('pagehide',()=>{badgeGame=null;clearTimeout(badgeTimer);});return;}
 let kind=new URLSearchParams(location.search).get('kind');if(kind==='draft')kind='weekdraft';if(!details[kind])kind='names';
 let timer=null,search=null,busy=false,cancelRequested=false,version=0,stopped=false;
 app.innerHTML=`<div class="online-layout"><section class="card online-card online-arena"><div class="online-arena-head"><div><span class="online-eyebrow">HEAD TO HEAD · RANKED</span><h2 class="disp" id="onlineArenaTitle">Name Race</h2><p id="onlineArenaDescription">Claim the most names. Beat the clock.</p></div><img src="/assets/game-icons/online-ranked.svg" width="96" height="96" alt="" class="online-arena-art"></div><div class="online-modes" role="group" aria-label="Choose your game">${[['names','names-race','Name race'],['grid','grid-race','Grid race'],['all','drafts','All games']].map(([key,icon,label])=>`<button type="button" data-online-kind="${key}" aria-pressed="false" ${key==='all'?'aria-haspopup="dialog" aria-controls="onlineGamePicker"':''}><img src="/assets/game-icons/${icon}.svg" width="34" height="34" alt=""><span>${label}</span></button>`).join('')}</div><p class="online-chosen" id="onlineChosen" hidden></p><select id="onlineKind" hidden aria-label="Choose your game">${Object.entries(details).map(([k,d])=>`<option value="${k}">${d[0]}</option>`).join('')}</select><div class="online-summary" aria-label="Your ranked progress"><div class="online-stat-main"><small>🏆 Trophies</small><b id="onlineRating">—</b></div><div><small>World rank</small><b id="onlineTier">Unranked</b></div><div><small>W–L</small><b id="onlineRecord">—</b></div></div><div class="online-actions"><button class="btn gold big" id="onlineFind"><span aria-hidden="true">⚡</span> Find opponent</button><button class="btn" id="onlineCancel" hidden>Cancel search</button><a class="btn" id="onlineFriend">Play a friend <span aria-hidden="true">↗</span></a></div><p id="onlineStatus" class="online-status" role="status">Choose your game. Make your move.</p><details class="online-rules"><summary>The game plan</summary><p id="onlineRules" class="online-note"></p><p class="online-note">Trophies start at 0 for each game. Win +30–34; lose 20–30, with a floor of 0. Your opponent’s skill rating at pairing sets the change: stronger opponents mean bigger wins and smaller losses. World rank compares all eligible players in that game; equal trophy totals share a rank. Your first completed trophy match places you. Skill rating stays separate. Historical draws stay in history. Leave or disconnect for 90 seconds while your opponent stays connected and you forfeit. If both disconnect, the match closes without awards. Private friend games are unranked.</p></details></section><section class="card online-card online-standings"><div class="online-board-head"><div><div class="kicker">THE COMPETITION</div><h2 class="disp">Leaderboard</h2></div><span class="online-podium" aria-hidden="true">★</span></div><div id="onlineBoard">Loading rankings…</div></section></div>`;
 const $=id=>document.getElementById(id),status=text=>{$('onlineStatus').textContent=text;};
 const picker=document.createElement('dialog');picker.id='onlineGamePicker';picker.className='online-game-picker';picker.setAttribute('aria-labelledby','onlinePickerTitle');
 picker.innerHTML=`<div class="online-picker-head"><div><span class="kicker">PICK YOUR NEXT MATCH</span><h2 class="disp" id="onlinePickerTitle">All games</h2></div><button type="button" class="btn" id="onlinePickerClose" aria-label="Close game picker">✕</button></div><p class="online-note">Choose a ranked game. Each has its own trophies and leaderboard.</p><div class="online-picker-grid">${Object.entries(details).map(([key,d])=>`<button type="button" data-picker-kind="${key}"><img src="/assets/game-icons/${({names:'names-race',grid:'grid-race',weekdraft:'drafts'})[key]}.svg" width="58" height="58" alt=""><b>${esc(d[0])}</b><span>${({names:'Claim the most names',grid:'Race for 25 squares',weekdraft:'Draft three. Spin the week.'})[key]}</span></button>`).join('')}</div>`;
 document.body.appendChild(picker);picker.querySelector('#onlinePickerClose').onclick=()=>picker.close();
 picker.querySelectorAll('[data-picker-kind]').forEach(b=>b.onclick=()=>{if(busy||search)return;kind=b.dataset.pickerKind;paint();picker.close();});
 function controls(){ $('onlineKind').disabled=busy||!!search;app.querySelectorAll('[data-online-kind]').forEach(b=>b.disabled=busy||!!search);$('onlineFind').disabled=busy||!!search;$('onlineCancel').hidden=!busy&&!search;$('onlineCancel').disabled=cancelRequested;}
 function stopSearch(){clearTimeout(timer);search=null;busy=false;cancelRequested=false;controls();}
 function enter(s){stopSearch();stopped=true;status('Opponent found. Opening your match…');location.assign(LFI.games.link(s.kind,s.code));}
 async function board(){const rev=++version;try{const b=await LFI.games.onlineBoard(kind);if(rev!==version||stopped)return;$('onlineRating').textContent=Number(b.me.trophies).toLocaleString();$('onlineTier').textContent=trophyRank(b.me);$('onlineRecord').textContent=`${b.me.wins}–${b.me.losses}`;$('onlineBoard').innerHTML=b.players.length?`<ol class="online-board">${b.players.map(p=>`<li><span class="online-place" data-place="${p.worldRank}">${p.tied?'=':''}#${p.worldRank}</span><div><strong>${esc(p.name)}</strong><small>@${esc(p.handle)} · ${p.wins}–${p.losses}</small></div><b>🏆 ${p.trophies}</b></li>`).join('')}</ol>`:'<p>No trophy matches completed yet. Play to join the board.</p>';}catch(e){if(rev===version){$('onlineRating').textContent='—';$('onlineBoard').textContent=errorText(e);}}}
 function paint(){
  const art={names:'names-race',grid:'grid-race',weekdraft:'drafts'},copy={names:['Name Race','Claim the most names. Beat the clock.'],grid:['Grid Race','25 squares. One rival. Make them yours.'],weekdraft:['Draft Battle','Draft three. Spin the week. First to two wins.']};
  $('onlineArenaTitle').textContent=copy[kind][0];$('onlineArenaDescription').textContent=copy[kind][1];app.querySelector('.online-arena-art').src='/assets/game-icons/'+art[kind]+'.svg';
  $('onlineKind').value=kind;const alternatives=Object.keys(details).filter(key=>key!==kind);app.querySelectorAll('[data-online-kind]').forEach((b,i)=>{const key=i<2?alternatives[i]:'all',label=key==='all'?'All games':copy[key][0];b.dataset.onlineKind=key;b.removeAttribute('aria-pressed');b.querySelector('img').src='/assets/game-icons/'+(key==='all'?'online-ranked':art[key])+'.svg';b.querySelector('span').textContent=label;if(key==='all'){b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','onlineGamePicker');}else{b.removeAttribute('aria-haspopup');b.removeAttribute('aria-controls');}});$('onlineChosen').hidden=true;$('onlineRules').textContent=details[kind][2];$('onlineFriend').href=details[kind][1];board();}
 async function handle(s){
  if(s.state==='matched'){enter(s);return;}
  if(s.state==='waiting'){
   search=s.id;
   if(cancelRequested){const c=await LFI.games.onlineCancel(search,kind);if(c.state==='matched'){enter(c);return;}stopSearch();status('Search cancelled.');return;}
   busy=false;controls();status('Looking for another player… Keep this tab open. No opponent has joined yet.');schedule();return;
  }
  stopSearch();status(s.state==='done'?'That match has finished. Find another opponent.':'Search ended. You can try again.');board();
 }
 function schedule(){clearTimeout(timer);if(!stopped&&!document.hidden&&search)timer=setTimeout(poll,3000);}
 async function poll(){if(stopped||document.hidden||busy||!search)return;busy=true;try{await handle(await LFI.games.onlineState(null,kind));}catch(e){status('Connection interrupted. Reconnecting to your search…');busy=false;controls();schedule();}}
 $('onlineFind').onclick=async()=>{if(busy||search)return;const me=await LFI.games.me();if(!me){location.assign(LFI.games.signInUrl());return;}if(busy||search||stopped)return;busy=true;cancelRequested=false;controls();status('Starting your search…');try{await handle(await LFI.games.onlineFind(kind));}catch(e){stopSearch();status(errorText(e));}};
 $('onlineCancel').onclick=async()=>{if(cancelRequested)return;cancelRequested=true;controls();if(busy)return;busy=true;try{const s=await LFI.games.onlineCancel(search,kind);if(s.state==='matched')enter(s);else{stopSearch();status('Search cancelled.');}}catch(e){busy=false;cancelRequested=false;controls();status(errorText(e));schedule();}};
 $('onlineKind').onchange=e=>{kind=e.target.value;paint();};
 app.querySelectorAll('[data-online-kind]').forEach(b=>b.onclick=()=>{if(busy||search)return;if(b.dataset.onlineKind==='all'){picker.showModal();return;}if(kind===b.dataset.onlineKind)return;kind=b.dataset.onlineKind;paint();});
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)poll();});
 window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);clearTimeout(badgeTimer);});
 paint();controls();
})();
