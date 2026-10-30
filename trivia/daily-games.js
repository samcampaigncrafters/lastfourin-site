(function(){
'use strict';
const D=window.BubbleDaily,{esc,toast}=LFI,$=id=>document.getElementById(id),game=document.body.dataset.dailyGame,KEY='bubble-daily-games-v1';
const labels={'player-guess':'NFL Player Guess','daily-grid':'Daily Nine','rare-air':'Rare Air'},title=labels[game];
const nowDay=D.today(),query=new URLSearchParams(location.search),asked=query.get('date'),date=D.validDate(asked)&&asked>=D.EPOCH&&asked<=nowDay?asked:nowDay;
let mode=game==='player-guess'&&query.get('mode')==='all'?'all':game==='player-guess'?'classic':'standard';
const original=game==='player-guess'&&query.get('edition')==='original',edition=game==='player-guess'&&!original?'-starters-v1':'';
const stateKey=game+'/'+mode+edition+'/'+date;let store;
try{store=JSON.parse(localStorage.getItem(KEY))||{days:{}};if(!store.days||typeof store.days!=='object')store={days:{}}}catch{store={days:{}}}
let state=store.days[stateKey];if(!state||state.catalog!=='nfl-20261029')state={catalog:'nfl-20261029',guesses:[],attempts:[],answers:[],deadline:0};
for(const k of ['guesses','attempts','answers'])if(!Array.isArray(state[k]))state[k]=[];
store.days[stateKey]=state;
let I,board,questions,answer,eligible,saveWarning=false,finishConfirm=false,interval;
function persist(){
 try{
  const fresh=JSON.parse(localStorage.getItem(KEY)||'null'),other=fresh&&fresh.days&&fresh.days[stateKey];
  if(other&&(other.revision||0)>(state.revision||0)){state=other;store=fresh;toast('This puzzle changed in another tab. Your latest saved progress is restored.');return false;}
  state.revision=(state.revision||0)+1;store={days:{...(fresh&&fresh.days||{}),...store.days,[stateKey]:state}};
  // Other tabs own their own puzzle keys. Their newer values take precedence.
  if(fresh&&fresh.days)for(const [key,value]of Object.entries(fresh.days))if(key!==stateKey)store.days[key]=value;
  localStorage.setItem(KEY,JSON.stringify(store));return true;
 }catch{if(!saveWarning){saveWarning=true;toast('This browser could not save progress. Keep this page open to finish.')}return true;}
}
const pretty=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'});
const prettyHeight=n=>Math.floor(n/12)+'′'+n%12+'″';
const dots=(n,total)=>`<div class="daily-dots" aria-label="${n} of ${total} used">${Array.from({length:total},(_,i)=>`<i class="${i<n?'filled':''}"></i>`).join('')}</div>`;
const sourceLink='<a href="https://github.com/nflverse/nflverse-data" target="_blank" rel="noopener">nflverse</a> (CC-BY 4.0)';
const playUrl=()=>`/trivia/${game}/?date=${date}${game==='player-guess'?'&mode='+mode+(original?'&edition=original':''):''}`;
const error=text=>{const p=$('gameError');if(p)p.textContent=text};
function ribbon(left,right){$('ribbon').innerHTML=`<div class="daily-ribbon"><div><small>${esc(left)}</small><strong>${esc(title)}</strong></div><strong>${esc(right)}</strong></div>`}
function recordStats(){
 const prefixes=[game+'/'+mode+'/',...(game==='player-guess'?[game+'/'+mode+'-starters-v1/']:[])],byDate=new Map();
 for(const prefix of prefixes)for(const [key,value]of Object.entries(store.days))if(key.startsWith(prefix)&&value.summary)byDate.set(key.slice(prefix.length),{date:key.slice(prefix.length),...value.summary});
 const rows=[...byDate.values()];
 const count=rows.length,wins=rows.filter(r=>r.won).length,dates=new Set(rows.filter(r=>r.won).map(r=>r.date));let streak=0;
 let at=date;if(!dates.has(at)){const d=new Date(at+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);at=d.toISOString().slice(0,10)}
 for(let n=0;n<rows.length&&dates.has(at);n++){streak++;const d=new Date(at+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);at=d.toISOString().slice(0,10)}
 $('dailyStats').innerHTML=`<div class="daily-stats"><div><b>${count}</b><small>Played</small></div><div><b>${wins}</b><small>${game==='rare-air'?'Completed':'Solved'}</small></div><div><b>${streak}</b><small>Day streak</small></div></div><p class="daily-note">${game==='player-guess'?'Each player pool keeps its own record. ':''}This record is kept on this device.</p>`;
}
function completed(score,max,won,emoji,extra){
 const shareText=`PlayBubble · ${title} #${D.dayNumber(date)}${game==='player-guess'?' · '+(mode==='all'?'All positions':'Classic'):''}\n${emoji}\n${score}/${max}${extra?' · '+extra:''}\n${pretty(date)}`;
 if(!state.summary){state.summary={score,max,won,finished:Date.now()};if(!persist())return shareText;LFI.entries.put({id:'bubble-'+game+'-'+mode+edition+'-'+date,kind:'trivia',title:title+' #'+D.dayNumber(date),sub:pretty(date),url:playUrl(),result:won?(game==='rare-air'?'Completed':'Solved'):'Finished',data:{score:`${score}/${max}${extra?' · '+extra:''}`,grid:emoji},shareText})}
 recordStats();return shareText;
}
function shareButton(text){const b=$('shareScore');if(b)b.onclick=async()=>toast(await LFI.copyText(text+'\n'+location.origin+playUrl())?'Score copied. No answers included.':'Could not copy here. Try your browser’s Share menu.')}
function endButtons(){return'<div class="daily-actions"><button type="button" class="btn gold" id="shareScore">Copy score</button><a class="btn" href="/account/">My picks</a></div><p class="daily-note">Today’s game is complete. A fresh puzzle opens at midnight Eastern.</p>'}
function searchBox(id,label){return `<div class="daily-search"><label for="${id}">${esc(label)}</label><input id="${id}" type="search" autocomplete="off" autocapitalize="words" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}Options" maxlength="80" placeholder="Start typing a player’s name"><p class="daily-note search-count" id="${id}Count" role="status" aria-live="polite"></p><div class="daily-results" role="listbox" id="${id}Options" aria-label="Matching NFL players"></div></div>`}
function mountSearch(id,candidates,onPick,used=new Set()){
 const input=$(id),list=$(id+'Options');let rows=[];
 function results(){
  const q=D.norm(input.value);rows=D.search(candidates,input.value);
  list.innerHTML=rows.map(p=>`<button type="button" role="option" aria-selected="false" data-player-id="${esc(p.id)}" ${used.has(p.id)?'disabled':''}><span>${esc(p.n)}</span><small>${used.has(p.id)?'Already used':esc(p.current&&game==='player-guess'?p.current.pos:p.pos)}</small></button>`).join('');
  if(q&&!rows.length)list.innerHTML='<p class="daily-empty">No matching player in this game’s data. Try the full name.</p>';
  $(id+'Count').textContent=q?rows.length+' matching '+(rows.length===1?'player':'players')+(rows.length>8?' · scroll or type more to narrow':''):'';
  input.setAttribute('aria-expanded',String(!!q));
 }
 input.oninput=results;
 input.onkeydown=e=>{
  if(e.key==='ArrowDown'){const b=list.querySelector('button:not(:disabled)');if(b){e.preventDefault();b.focus()}}
  if(e.key==='Enter'){e.preventDefault();const q=D.norm(input.value),exact=rows.filter(p=>D.norm(p.n)===q||p.aliases.some(n=>D.norm(n)===q));const p=exact.length===1?exact[0]:rows.length===1?rows[0]:null;if(p&&!used.has(p.id))onPick(p);else error('Choose a player from the matching names.')}
  if(e.key==='Escape'&&list.childElementCount){e.preventDefault();list.innerHTML='';input.setAttribute('aria-expanded','false')}
 };
 list.onclick=e=>{const b=e.target.closest('[data-player-id]');if(b&&!b.disabled)onPick(I.byId.get(b.dataset.playerId))};
 list.onkeydown=e=>{const buttons=[...list.querySelectorAll('button:not(:disabled)')],at=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const n=at+(e.key==='ArrowDown'?1:-1);if(n<0)input.focus();else(buttons[n]||buttons.at(-1))?.focus()}};
}
function rules(){
 const shared='<p class="daily-note">The daily puzzle is the same for everyone. Progress survives refreshes in this browser. Copy your score without revealing the answers.</p>';
 if(game==='player-guess'){
  $('dailyRules').innerHTML='<ol><li>Find the mystery player in eight guesses.</li><li>✓ Green means an exact match. ≈ Yellow means a related position, or a number within two.</li><li>↑ means the target is older, taller or has a higher jersey number. ↓ means lower.</li><li>Classic uses starting QBs, RBs, the first two WRs and TEs. All positions adds starting linemen, defenders, kickers and punters; it is harder.</li></ol>'+shared;
  if(original)$('dailyRules').innerHTML=$('dailyRules').innerHTML.replace('Classic uses starting QBs, RBs, the first two WRs and TEs. All positions adds starting linemen, defenders, kickers and punters; it is harder.','Your earlier edition uses the original roster pool. Switch to the starter edition for the updated selection.');
  $('dailySource').innerHTML=`Facts: ${sourceLink}. 2026 active-roster snapshot prepared Oct 29. Ages use the puzzle date and actual birth dates. ${original?'Original roster edition.': 'Starter edition: first listed players on the Oct 29 depth charts, matched to these roster facts.'} This is a dated snapshot, not a live transaction feed.`;
 }else if(game==='daily-grid'){
  $('dailyRules').innerHTML='<ol><li>Tap any square. Name a player who fits both its row and column.</li><li>Nine attempts total. An incorrect player uses an attempt; you may retry that square.</li><li>Each correct player can appear only once.</li><li>Milestones mean one regular season with the row’s franchise. Career totals and playoffs do not count. Relocated teams count as the same franchise.</li></ol>'+shared;
  $('dailySource').innerHTML=`Facts: ${sourceLink}. All positions. Recorded regular-season stats, 1999–2025, plus offense, defense and special-teams snaps, 2013–2025. No roster-only, preseason or practice-squad credit. Some older players without a recorded stat or snap may be absent. Every board has nine different valid answers.`;
 }else{
  $('dailyRules').innerHTML='<ol><li>Seven football prompts. You get 25 seconds per answer; the clock starts when you begin each question.</li><li>Type a full player name. One answer per prompt. A correct deep cut scores more.</li><li>Each question has one daily Deep Cut worth 100. Maximum: 700 points.</li><li>Refreshing keeps the clock running. You can take a break between questions.</li></ol><details data-free><summary>How obscurity points work</summary><p class="daily-note">Points compare recorded career, best-season and recent PPR production, plus stat-bearing appearances among that question’s eligible players. Lower exposure generally scores higher. These are fixed difficulty points, not live player-pick percentages. The daily Deep Cut is selected from lesser-known players with at least eight recorded appearances.</p></details>'+shared;
  $('dailySource').innerHTML=`Facts: ${sourceLink}. Original prompts about QB, RB, FB, WR and TE with recorded regular-season offensive stats, 1999–2025. College and draft facts use nflverse’s player metadata. Independent Bubble scoring.`;
 }
}
function guessRow(p,n){const hints=D.feedback(I,p,answer,date),names=['Team','Conf','Division','Position','Age','Height','Jersey'];return `<article class="guess-row"><div class="guess-name"><span>${esc(p.n)}</span><small>#${n}</small></div><div class="hint-tiles">${hints.map((h,i)=>`<div class="hint-tile ${h.state}" aria-label="${names[i]} ${esc(i===5?prettyHeight(h.value):h.value)}, ${h.state==='exact'?'exact match':h.symbol==='↑'?'target is higher':h.symbol==='↓'?'target is lower':h.state==='close'?'related position':'not a match'}"><small>${['TEAM','CONF','DIV','POS','AGE','HT','#'][i]}</small><span>${esc(i===5?prettyHeight(h.value):h.value)}</span><span class="hint-symbol" aria-hidden="true">${h.symbol}</span></div>`).join('')}</div></article>`}
function drawGuess(){
 const valid=new Set(eligible.map(p=>p.id));state.guesses=[...new Set(state.guesses.filter(id=>valid.has(id)))].slice(0,8);
 const guesses=state.guesses.map(id=>I.byId.get(id)),won=state.guesses.includes(answer.id),done=won||state.guesses.length>=8||state.finished;
 ribbon((original?'Original edition · ':'Starters · ')+(mode==='all'?'All positions · harder':'QB / RB / WR / TE'),done?(won?'Solved':'Finished'):`${8-guesses.length} ${guesses.length===7?'guess':'guesses'} left`);
 const emoji=guesses.map(p=>D.feedback(I,p,answer,date).map(h=>h.state==='exact'?'🟩':h.state==='close'?'🟨':'⬛').join('')).join('\n');
 let text='';if(done)text=completed(won?guesses.length:'X',8,won,emoji,won?'guesses':'not solved');
 $('dailyGame').innerHTML=`<div class="card-b"><div class="daily-mode" aria-label="Player pool"><button type="button" data-mode="classic" aria-pressed="${mode==='classic'}">Classic</button><button type="button" data-mode="all" aria-pressed="${mode==='all'}">All positions</button></div>${!original&&store.days['player-guess/'+mode+'/'+date]?.guesses?.length?`<p class="daily-note"><a href="/trivia/player-guess/?date=${date}&mode=${mode}&edition=original">Resume your earlier puzzle →</a></p>`:original?`<p class="daily-note"><a href="/trivia/player-guess/?date=${date}&mode=${mode}">Play the starter edition →</a></p>`:''}${dots(guesses.length,8)}${done?`<h2 class="disp">${won?'That’s your player.':'Today’s player'}</h2><p class="blurb"><b>${esc(answer.n)}</b> · ${esc(answer.current.pos)} · ${esc(I.data.teams[answer.current.team].name)}</p>${endButtons()}`:`<h2 class="disp">Who’s in the huddle?</h2><p class="blurb">${original?'Your earlier roster puzzle is preserved here.':'A starting player. Eight guesses. Follow the clues.'}</p>${searchBox('playerSearch','Your NFL player guess')}<p id="gameError" class="daily-error" role="alert"></p>`}<div class="daily-legend"><span><b>✓</b> Exact</span><span><b>≈</b> Close / related</span><span><b>↑ ↓</b> Go higher / lower</span></div><div class="guess-list">${guesses.slice().reverse().map((p,i)=>guessRow(p,guesses.length-i)).join('')}</div>${!done?`<div class="daily-actions"><button type="button" class="btn" id="giveUp">${finishConfirm?'Confirm: reveal and finish':'Give up and reveal'}</button></div>`:''}</div>`;
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{location.href=`/trivia/player-guess/?date=${date}&mode=${b.dataset.mode}${original?'&edition=original':''}`});
 if(done)shareButton(text);else{
  mountSearch('playerSearch',eligible,p=>{if(state.guesses.includes(p.id))return error('You already guessed that player.');state.guesses.push(p.id);persist();drawGuess();if(!state.summary)$('playerSearch')?.focus()},new Set(state.guesses));
  $('giveUp').onclick=()=>{if(!finishConfirm){finishConfirm=true;$('giveUp').textContent='Confirm: reveal and finish';return}state.finished=true;persist();drawGuess()};
 }
 recordStats();
}
function gridSummary(){return D.gridState(board,state.attempts)}
function gridRecap(n){
 const recent=p=>Math.max(0,...(p.years||[]));
 const gridPlayers=new Map(I.gridHistory.map(p=>[p.id,p]));
  const players=board.pools[n].map(id=>gridPlayers.get(id)).sort((a,b)=>recent(b)-recent(a)||(b.games||0)-(a.games||0)||a.n.localeCompare(b.n));
 return `<p>${players.length} accepted answers · Recent examples: ${players.slice(0,4).map(p=>esc(p.n)).join(' · ')}</p><details data-free><summary>Show all ${players.length} accepted answers</summary><p class="daily-note">Most recent recorded season first.</p><p>${players.map(p=>esc(p.n)).join(' · ')}</p></details>`;
}
function drawGrid(note=''){
 const s=gridSummary(),done=s.done||state.finished;let share='';ribbon('Nine squares. Nine attempts.',done?`${s.correct}/9`:`${9-s.attempts} ${s.attempts===8?'attempt':'attempts'} left`);
 const emoji=[0,1,2].map(r=>s.cells.slice(r*3,r*3+3).map(x=>x?'🟩':'⬜').join('')).join('\n');if(done)share=completed(s.correct,9,s.correct===9,emoji);
 let cells='<div aria-hidden="true"></div>'+board.columns.map(c=>`<div class="grid-label" title="${esc(c.detail)}">${c.kind==='team'?`<b>${esc(c.id)}</b><small>${esc(c.label)}</small>`:esc(c.label)+(c.kind==='milestone'?'<small>Single regular season</small>':'')}</div>`).join('');
 board.rows.forEach((t,r)=>{cells+=`<div class="grid-label"><b>${t}</b><small>${esc(I.data.teams[t].name)}</small></div>`;board.columns.forEach((c,col)=>{const n=r*3+col,p=I.byId.get(s.cells[n]);cells+=`<button type="button" class="grid-cell ${p?'solved':done?'failed':''}" data-cell="${n}" ${done||p?'disabled':''} aria-label="${esc(I.data.teams[t].name)} × ${esc(c.label)}${p?', '+esc(p.n):', empty'}">${p?`<span class="cell-mark">✓</span>${esc(p.n)}`:`<span class="cell-plus" aria-hidden="true">${done?'—':'+'}</span><span class="sr-only">Choose a player</span>`}</button>`})});
 $('dailyGame').innerHTML=`<div class="card-b"><div class="daily-topline"><h2 class="disp">${done?(s.correct===9?'Nine for nine.':'Your daily grid'):'Find the connection'}</h2><b>${s.correct}/9 filled</b></div><p class="daily-note">All positions · regular-season appearances · 1999–2025</p><div class="daily-grid" aria-label="Daily nine-square NFL grid">${cells}</div><p class="daily-error" role="status">${esc(note)}</p>${done?endButtons()+`<div class="grid-recap"><h3 class="disp">Answers for unfilled squares</h3>${s.cells.map((id,n)=>id?'':`<div><b>${esc(I.data.teams[board.rows[Math.floor(n/3)]].name)} × ${esc(board.columns[n%3].label)}</b>${gridRecap(n)}</div>`).join('')||'<p>You found a different player for every square.</p>'}</div>`:`<div class="daily-actions"><button type="button" class="btn" id="finishGrid">${finishConfirm?'Confirm: finish and reveal':'Finish and reveal'}</button></div>`}</div>`;
 if(done)shareButton(share);else{
  document.querySelectorAll('[data-cell]').forEach(b=>b.onclick=()=>openCell(Number(b.dataset.cell)));
  $('finishGrid').onclick=()=>{if(!finishConfirm){finishConfirm=true;$('finishGrid').textContent='Confirm: finish and reveal';return}state.finished=true;persist();drawGrid()};
 }
 recordStats();
}
function openCell(n){
 const s=gridSummary();if(s.done||state.finished||s.cells[n])return;
 const row=board.rows[Math.floor(n/3)],col=board.columns[n%3],dialog=$('playerDialog');$('playerDialogKicker').textContent=`${9-s.attempts} ${s.attempts===8?'attempt':'attempts'} left`;$('playerDialogTitle').textContent=I.data.teams[row].name+' × '+col.label;
 $('playerDialogBody').innerHTML=`<p>${esc(col.kind==='team'?'Name a player at any position who appeared in a regular-season game for both franchises.':col.detail)} (1999–2025.)</p>${searchBox('gridSearch','Player for this square')}<p id="gameError" class="daily-error" role="alert"></p>`;
 mountSearch('gridSearch',I.gridHistory,p=>{
  const latest=gridSummary();if(latest.used.has(p.id))return error('That player already fills another square.');
  state.attempts.push({cell:n,id:p.id});persist();dialog.close();const right=board.pools[n].includes(p.id);
  const requirement=col.kind==='milestone'?` This square requires ${col.detail.replace(/^A /,'a ').replace('one season','one regular season').replace('this franchise',I.data.teams[row].name)}.`:'';
  drawGrid(right?`${p.n} fits both clues.`:`${p.n} does not fit both clues.${requirement} One attempt used.`);
 },s.used);dialog.showModal();$('gridSearch').focus();
}
function rareScore(a,i){return a&&a.id&&questions[i].answers.includes(a.id)&&!a.expired&&!a.passed?questions[i].points[a.id]:0}
function answerRare(text,pass=false){
 if(!state.deadline||state.answers.length>=7)return;
 const i=state.answers.length,r=D.rareAnswer(I,questions[i],text,Date.now(),state.deadline);if(r.error)return error(r.error);if(pass)r.passed=true;
 state.answers.push(r);state.deadline=0;if(state.answers.length===7)state.finished=true;persist();drawRare();
}
function startRare(){if(state.answers.length>=7)return;state.started=true;state.deadline=Date.now()+25000;persist();drawRare();$('rareAnswer')?.focus()}
function rareHint(q){const best=q.answers.filter(id=>id!==q.gem).sort((a,b)=>q.points[b]-q.points[a]).slice(0,3);return `<b>Today’s Deep Cut:</b> ${esc(I.byId.get(q.gem).n)} · 100 points<br>Other deep cuts: ${best.map(id=>esc(I.byId.get(id).n)+' ('+q.points[id]+')').join(' · ')}`}
function drawRare(){
 const answers=state.answers.slice(0,7),done=answers.length>=7,total=answers.reduce((s,a,i)=>s+rareScore(a,i),0);ribbon('Seven prompts. Go beyond the obvious.',`${total}/700`);
 if(done){
  const emoji=answers.map((a,i)=>rareScore(a,i)>=90?'🟪':rareScore(a,i)>=60?'🟩':rareScore(a,i)>0?'🟨':'🟥').join(''),valid=answers.filter((a,i)=>rareScore(a,i)>0).length,text=completed(total,700,true,emoji,valid+'/7 valid');
  $('dailyGame').innerHTML=`<div class="card-b"><div class="kicker">${valid} of 7 valid answers</div><h2 class="disp">${total>=500?'Deep cuts only.':total>=300?'You know ball.':'There’s always tomorrow.'}</h2><div class="daily-score">${total}<small> / 700</small></div><div class="daily-result-grid">${emoji}</div>${endButtons()}<div>${answers.map((a,i)=>`<div class="rare-recap"><strong>${esc(questions[i].q)}</strong><span>${a.expired?'Time ran out':a.passed?'Passed':a.id?esc(I.byId.get(a.id)?.n||a.typed):esc(a.typed||'No answer')} · ${rareScore(a,i)} points</span><p class="rare-examples">${rareHint(questions[i])}</p></div>`).join('')}</div></div>`;shareButton(text);recordStats();return;
 }
 if(!state.started){$('dailyGame').innerHTML=`<div class="card-b"><div class="kicker">Daily football deep cuts</div><h2 class="disp">The obvious answer isn’t always the best.</h2><p class="blurb">Seven prompts. Twenty-five seconds each. Name a valid player — the more obscure, the better.</p><div class="rare-rounds" aria-hidden="true">${Array.from({length:7},(_,i)=>`<span>${i+1}</span>`).join('')}</div><p>QB, RB, FB, WR and TE · NFL regular-season stats, 1999–2025.</p><button class="btn gold" id="rareStart">Play today’s seven</button><p class="daily-note">Each question’s clock begins only when you’re ready. Obscurity points use career profiles, not player-pick percentages.</p></div>`;$('rareStart').onclick=startRare;recordStats();return;}
 if(!state.deadline&&answers.length){
  const i=answers.length-1,a=answers[i],points=rareScore(a,i),name=a.id?I.byId.get(a.id)?.n:a.typed;
  $('dailyGame').innerHTML=`<div class="card-b">${dots(answers.length,7)}<div class="kicker">Question ${answers.length} of 7</div><p class="rare-prompt">${esc(questions[i].q)}</p><section class="rare-reveal"><h3>${a.expired?'Time’s up':a.passed?'Passed':points===0?'No points this round':a.gem?'You found the Deep Cut!':'That’s a valid answer.'}</h3><p>${esc(name||'No answer')} ${points===0&&!a.expired&&!a.passed?'is not in this prompt’s verified answer set.':''}</p><div class="daily-score">${points}<small> / 100</small></div><p class="rare-examples">${rareHint(questions[i])}</p></section><button class="btn gold" id="rareNext">Next question · start 25 seconds</button><p class="daily-note">Take your time here. The next clock starts when you tap.</p></div>`;$('rareNext').onclick=startRare;recordStats();return;
 }
 const i=answers.length;
 $('dailyGame').innerHTML=`<div class="card-b">${dots(i,7)}<div class="kicker">Question ${i+1} of 7 · 1999–2025</div><div class="rare-time"><strong id="rareSeconds" role="timer" aria-live="off">25s</strong><div class="rare-bar" aria-hidden="true"><i id="rareBar"></i></div></div><p class="rare-prompt">${esc(questions[i].q)}</p><form id="rareForm"><label for="rareAnswer"><b>Your answer</b></label><input class="rare-input" id="rareAnswer" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Type a full player name" maxlength="80" required><p id="gameError" class="daily-error" role="alert"></p><div class="daily-actions"><button class="btn gold" type="submit">Lock answer</button><button class="btn" type="button" id="rarePass">Pass</button></div></form><p class="daily-note">No take-backs. Refreshing keeps this question’s clock running.</p></div>`;
 $('rareForm').onsubmit=e=>{e.preventDefault();answerRare($('rareAnswer').value)};$('rarePass').onclick=()=>answerRare('',true);tick();recordStats();
}
function tick(){if(game!=='rare-air'||!state.deadline)return;const left=state.deadline-Date.now();if(left<=0){answerRare('');return}if($('rareSeconds'))$('rareSeconds').textContent=Math.ceil(left/1000)+'s';if($('rareBar'))$('rareBar').style.width=Math.min(100,Math.max(0,left/250))+'%'}
$('playerDialog').querySelector('.dialog-close').onclick=()=>$('playerDialog').close();
for(const a of document.querySelectorAll('.daily-links a'))if(new URL(a.href).pathname===location.pathname)a.setAttribute('aria-current','page');
$('dailyDate').innerHTML=`<b>${esc(pretty(date))}</b> Daily #${D.dayNumber(date)}`;
(async()=>{
 try{
  const r=await fetch('/trivia/nfl-20261029.json');if(!r.ok)throw Error('Could not load the NFL facts.');const data=await r.json();if(data.version!==state.catalog)throw Error('The saved puzzle needs its original data version.');I=D.index(data);if(game==='daily-grid'){const extra=await fetch('/trivia/grid-appearances-20261029.json');if(!extra.ok)throw Error('Could not load the full grid player list.');I=D.extendGrid(I,await extra.json())}rules();
  if(game==='player-guess'){if(!original){const r=await fetch('/trivia/player-guess-starters-20261029.json');if(!r.ok)throw Error('Could not load the starter list.');I=D.withStarters(I,await r.json())}eligible=original?D.pool(I,mode):D.starterPool(I,mode);answer=original?D.target(I,date,mode):D.starterTarget(I,date,mode);drawGuess()}
  else if(game==='daily-grid'){board=D.grid(I,date);state.attempts=state.attempts.filter(a=>a&&Number.isInteger(a.cell)&&a.cell>=0&&a.cell<9&&I.byId.has(a.id)).slice(0,9);drawGrid()}
  else if(game==='rare-air'){questions=D.rare(I,date);state.answers=state.answers.slice(0,7).map(a=>a&&typeof a==='object'?a:{id:null,expired:true});drawRare();interval=setInterval(tick,200)}
 }catch(err){console.error(err);$('dailyGame').innerHTML=`<div class="card-b"><h2 class="disp">Couldn’t load today’s game.</h2><p>${esc(err.message||'Please try again.')}</p><button class="btn" id="dailyRetry">Try again</button></div>`;$('dailyRetry').onclick=()=>location.reload()}
})();
window.addEventListener('pagehide',()=>{clearInterval(interval);interval=null});
window.addEventListener('pageshow',()=>{if(game==='rare-air'&&I){tick();if(!interval)interval=setInterval(tick,200)}});
window.addEventListener('storage',e=>{
 if(e.key!==KEY||!I)return;
 try{const next=JSON.parse(e.newValue||'null');if(!next?.days)return;const other=next.days[stateKey];
  if(other&&(other.revision||0)>(state.revision||0)){state=other;store=next;if(game==='player-guess')drawGuess();else if(game==='daily-grid'){if($('playerDialog').open)$('playerDialog').close();drawGrid()}else drawRare();}
  else{store.days={...next.days,[stateKey]:state};recordStats();}
 }catch(err){console.warn('Could not refresh this browser’s game progress.',err)}
});
})();
