/* Original daily-game rules. Pure functions are shared by the page and factual validators. */
(function(root){
  'use strict';
  const VERSION='bubble-daily-v1',EPOCH='2026-10-29';
  const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,'').replace(/[^a-z0-9]/g,'');
  function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
  function random(seed){let a=hash(seed);return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
  function shuffled(a,r){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  const today=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  const validDate=date=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return false;const ms=Date.parse(date+'T12:00:00Z');return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===date};
  const dayNumber=date=>Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(EPOCH+'T12:00:00Z'))/86400000)+1;
  function age(birth,date){if(!/^\d{4}-\d{2}-\d{2}$/.test(birth||''))return null;return +date.slice(0,4)-+birth.slice(0,4)-(date.slice(5)<birth.slice(5)?1:0)}
  function family(pos){if(['RB','FB'].includes(pos))return'RB';if(['WR','TE'].includes(pos))return'receivers';if(['T','G','C','OT','OG','OL','LT','LG','RG','RT'].includes(pos))return'OL';if(['DE','DT','NT','DL'].includes(pos))return'DL';if(['LB','OLB','ILB','MLB'].includes(pos))return'LB';if(['DB','CB','FS','SS','S'].includes(pos))return'DB';return pos}
  function index(data){
    const byId=new Map(data.players.map(p=>[p.id,p])),history=data.players.filter(p=>p.teams.length),members={},alias=new Map();
    for(const t of Object.keys(data.teams))members[t]=history.filter(p=>p.teams.includes(t));
    for(const p of data.players){for(const n of [p.n,...p.aliases]){const key=norm(n);if(!alias.has(key))alias.set(key,new Set());alias.get(key).add(p.id)}}
    return {data,byId,history,members,alias};
  }
  function resolve(I,text){const n=norm(text);if(!n)return[];const direct=I.alias.get(n);if(direct)return[...direct];return I.data.players.filter(p=>norm(p.n.split(' ').filter(x=>!/^jr\.?$|^sr\.?$|^iii$|^ii$|^iv$/i.test(x)).at(-1))===n).map(p=>p.id)}
  function search(candidates,text){
    const q=norm(text),tokens=String(text||'').trim().split(/\s+/).map(norm).filter(Boolean);if(!q)return[];
    const names=p=>[p.n,...p.aliases];
    const rank=p=>names(p).some(n=>norm(n)===q)?0:names(p).some(n=>n.split(/\s+/).some(w=>norm(w).startsWith(q)))?1:2;
    return candidates.filter(p=>names(p).some(n=>norm(n).includes(q)||tokens.every(t=>norm(n).includes(t)))).sort((a,b)=>rank(a)-rank(b)||Number(!!b.current)-Number(!!a.current)||(b.games||0)-(a.games||0)||a.n.localeCompare(b.n)||a.id.localeCompare(b.id));
  }
  function extendGrid(I,extra){
    if(extra.version!=='grid-appearances-20261029')throw Error('The grid appearance catalog is not supported.');
    const byId=new Map(I.byId),gridById=new Map(I.byId);
    for(const p of extra.players){const old=byId.get(p.id);gridById.set(p.id,{...old,...p,marks:old?.marks||{},aliases:[...new Set([...(old?.aliases||[]),...p.aliases])],teams:[...new Set([...(old?.teams||[]),...p.teams])].sort()});if(!old)byId.set(p.id,gridById.get(p.id))}
    const gridHistory=[...gridById.values()].filter(p=>p.teams.length),gridMembers={};
    for(const t of Object.keys(I.data.teams))gridMembers[t]=gridHistory.filter(p=>p.teams.includes(t));
    return {...I,byId,gridHistory,gridMembers};
  }
  function pool(I,mode='classic'){return I.data.players.filter(p=>p.current&&I.data.teams[p.current.team]&&p.current.height>=60&&p.current.height<=90&&Number.isInteger(p.current.number)&&p.current.number>=0&&p.current.number<=99&&p.current.birth&&age(p.current.birth,'2026-10-29')>=18&&(mode==='all'||['QB','RB','WR','TE'].includes(p.current.pos)))}
  function target(I,date,mode='classic'){
    const candidates=shuffled(pool(I,mode),random(VERSION+'|'+I.data.version+'|'+mode));
    if(!candidates.length)throw Error('No current player catalog');
    return candidates[((dayNumber(date)-1)%candidates.length+candidates.length)%candidates.length];
  }
  function withStarters(I,snapshot){
    if(snapshot.version!=='player-guess-starters-20261029'||snapshot.catalog!==I.data.version||!Array.isArray(snapshot.starters))throw Error('The starter snapshot is not supported.');
    const starterIds=new Set();
    for(const row of snapshot.starters){const p=I.byId.get(row.id);if(!row.firstInSlot||!p?.current||p.current.team!==row.team||starterIds.has(row.id))throw Error('The starter snapshot does not match the player facts.');starterIds.add(row.id)}
    if(new Set(snapshot.starters.map(p=>p.team)).size!==32)throw Error('The starter snapshot is incomplete.');
    return {...I,starterIds,starterVersion:snapshot.version};
  }
  function starterPool(I,mode='classic'){
    if(!I.starterIds)throw Error('Could not load the starter pool.');
    return pool(I,mode).filter(p=>I.starterIds.has(p.id));
  }
  function starterTarget(I,date,mode='classic'){
    const candidates=shuffled(starterPool(I,mode),random(VERSION+'|'+I.starterVersion+'|'+mode));
    if(!candidates.length)throw Error('No eligible starters.');
    return candidates[((dayNumber(date)-1)%candidates.length+candidates.length)%candidates.length];
  }
  function feedback(I,guess,answer,date){
    const a=answer.current,g=guess.current,at=I.data.teams[a.team],gt=I.data.teams[g.team];
    const exact=(value,match,close=false)=>({value,state:match?'exact':close?'close':'miss',symbol:match?'✓':close?'≈':'×'});
    const numeric=(value,want,near)=>({value,state:value===want?'exact':Math.abs(value-want)<=near?'close':'miss',symbol:value===want?'✓':value<want?'↑':'↓'});
    return [exact(g.team,g.team===a.team),exact(gt.conference,gt.conference===at.conference),exact(gt.division.replace('AFC ','A ').replace('NFC ','N '),gt.division===at.division),exact(g.pos,g.pos===a.pos,family(g.pos)===family(a.pos)),numeric(age(g.birth,date),age(a.birth,date),2),numeric(g.height,a.height,2),numeric(g.number,a.number,2)];
  }
  function categoryMatch(p,team,c){if(c.kind==='team')return p.teams.includes(c.id);if(c.kind==='milestone')return(p.marks[team]||[]).includes(c.id);if(c.id==='round1')return p.draft===1;if(c.id==='late')return p.draft>=5&&p.draft<=7;if(c.id==='journey')return p.teams.length>=3;return false}
  function cellPool(I,row,col){return((I.gridMembers||I.members)[row]||[]).filter(p=>categoryMatch(p,row,col))}
  function uniqueSolution(pools){
    const sorted=pools.map((p,i)=>({p,i})).sort((a,b)=>a.p.length-b.p.length),used=new Set(),solution=[];
    function walk(n){if(n===sorted.length)return true;const {p,i}=sorted[n];for(const x of p){if(used.has(x.id))continue;used.add(x.id);solution[i]=x.id;if(walk(n+1))return true;used.delete(x.id)}return false}
    return walk(0)?solution:null;
  }
  function grid(I,date){
    const r=random(VERSION+'|grid|'+date),teams=Object.keys(I.data.teams),cache=new Map();
    // Keep the original board layout and saved guesses; broaden accepted answers only.
    const template={...I,gridMembers:null};
    const answers=(row,c)=>{const k=row+'/'+c.id;if(!cache.has(k))cache.set(k,cellPool(template,row,c));return cache.get(k)};
    for(let n=0;n<240;n++){
      const rows=shuffled(teams,r).slice(0,3),teamCols=shuffled(teams.filter(t=>!rows.includes(t)).map(t=>({id:t,label:I.data.teams[t].name,kind:'team',detail:'Recorded regular-season stats for both franchises'})),r).filter(c=>rows.every(t=>answers(t,c).length>=3));
      const cats=shuffled(I.data.categories,r).filter(c=>rows.every(t=>answers(t,c).length>=3));
      if(teamCols.length<2||!cats.length)continue;
      const columns=[teamCols[0],teamCols[1],cats[0]],pools=rows.flatMap(t=>columns.map(c=>answers(t,c))),solution=uniqueSolution(pools);
      if(solution)return{rows,columns,solution,pools:I.gridMembers?rows.flatMap(t=>columns.map(c=>cellPool(I,t,c).map(p=>p.id))):pools.map(p=>p.map(x=>x.id))};
    }
    throw Error('Could not deal a fully valid daily grid');
  }
  function gridState(board,attempts){
    const cells=Array(9).fill(null),used=new Set();let count=0;
    for(const a of attempts.slice(0,9)){if(!Number.isInteger(a.cell)||a.cell<0||a.cell>8||cells[a.cell]||used.has(a.id))continue;count++;if(board.pools[a.cell].includes(a.id)){cells[a.cell]=a.id;used.add(a.id)}}
    return{cells,used,attempts:count,correct:cells.filter(Boolean).length,done:count>=9||cells.every(Boolean)};
  }
  function rareBank(I){
    const history=I.history.filter(p=>p.games>=1),bank=[];
    function add(id,kind,q,answers){if(answers.length>=8&&answers.some(p=>p.games>=8))bank.push({id,kind,q,answers:answers.map(p=>p.id)})}
    for(const [t,v]of Object.entries(I.data.teams))add('team-'+t,'team',`Name a ${v.name} skill-position player.`,I.members[t]);
    for(const pos of ['QB','RB','WR','TE'])add('pos-'+pos,'position',`Name an NFL ${pos==='QB'?'quarterback':pos==='RB'?'running back':pos==='WR'?'wide receiver':'tight end'}.`,history.filter(p=>pos==='RB'?['RB','FB'].includes(p.pos):p.pos===pos));
    for(const c of I.data.categories.filter(c=>c.kind==='milestone'))add('mark-'+c.id,'milestone',`Name a player with ${c.detail.replace(/ for this franchise$/,'').replace(/^A /,'a ')}.`,history.filter(p=>p.seasonMarks.includes(c.id)));
    add('round1','draft','Name a first-round NFL draft pick.',history.filter(p=>p.draft===1));
    add('late','draft','Name an NFL player drafted in rounds five through seven.',history.filter(p=>p.draft>=5&&p.draft<=7));
    for(const round of [2,3,4,5,6,7])add('round-'+round,'draft',`Name a player drafted in NFL round ${round}.`,history.filter(p=>p.draft===round));
    const colleges=[...new Set(history.map(p=>p.college).filter(Boolean))];
    for(const college of colleges)add('college-'+norm(college),'college',`Name an NFL player who attended ${college}.`,history.filter(p=>p.college===college));
    add('journey','career','Name a player who recorded NFL stats for at least three franchises.',history.filter(p=>p.teams.length>=3));
    add('journey2','career','Name a player with offensive stats for at least two NFL franchises.',history.filter(p=>p.teams.length>=2));
    add('journey4','career','Name a player with offensive stats for at least four NFL franchises.',history.filter(p=>p.teams.length>=4));
    add('100games','career','Name a skill-position player with 100 stat-bearing NFL appearances.',history.filter(p=>p.games>=100));
    add('10seasons','career','Name a skill-position player with offensive stats in ten or more NFL seasons.',history.filter(p=>p.years.length>=10));
    for(const y of [2000,2010,2020])add('era-'+y,'era',`Name a skill-position player with NFL stats in the ${y}s.`,history.filter(p=>p.years.some(n=>n>=y&&n<y+10)));
    for(let y=I.data.from;y<=I.data.through;y++)add('year-'+y,'era',`Name a skill-position player with offensive NFL stats in ${y}.`,history.filter(p=>p.years.includes(y)));
    return bank;
  }
  function rare(I,date){
    const r=random(VERSION+'|rare|'+date),bank=rareBank(I),selected=[],take=kind=>{const choices=shuffled(bank.filter(q=>q.kind===kind&&!selected.some(s=>s.id===q.id)),r);if(choices.length)selected.push(choices[0])};
    for(const k of ['team','position','milestone','draft','college','career','era'])take(k);
    if(selected.length!==7)throw Error('Daily question coverage incomplete');
    return shuffled(selected,r).map(q=>{
      const ranked=q.answers.map(id=>I.byId.get(id)).sort((a,b)=>b.exposure-a.exposure||a.id.localeCompare(b.id)),points={};
      for(let i=0;i<ranked.length;){let end=i+1;while(end<ranked.length&&ranked[end].exposure===ranked[i].exposure)end++;const score=Math.round(10+90*(i+end-1)/2/Math.max(1,ranked.length-1));for(let j=i;j<end;j++)points[ranked[j].id]=score;i=end;}
      const gems=ranked.filter(p=>p.games>=8&&points[p.id]>=60&&points[p.id]<=90),gem=gems.length?gems[Math.floor(r()*gems.length)].id:ranked.filter(p=>p.games>=8).at(-1).id;
      points[gem]=100;return{...q,points,gem};
    });
  }
  function rareAnswer(I,q,text,now,deadline){
    if(now>=deadline)return{id:null,points:0,expired:true};
    const ids=resolve(I,text);if(ids.length>1)return{error:'More than one player has that name. Enter the full name.'};
    const id=ids.length===1?ids[0]:null,valid=!!id&&q.answers.includes(id);
    return{id,typed:String(text).trim().slice(0,80),points:valid?q.points[id]:0,valid,gem:valid&&id===q.gem};
  }
  const API={VERSION,EPOCH,norm,hash,random,shuffled,today,validDate,dayNumber,age,index,resolve,search,extendGrid,pool,target,withStarters,starterPool,starterTarget,feedback,grid,cellPool,uniqueSolution,gridState,rareBank,rare,rareAnswer};
  if(typeof module==='object'&&module.exports)module.exports=API;else root.BubbleDaily=API;
})(typeof self!=='undefined'?self:this);
