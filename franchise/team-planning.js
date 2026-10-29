/* Read-only team planning. Values are derived from the league; this module never applies moves or changes contracts. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FranchisePlanning=factory();})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const round=x=>Math.round(x*10)/10;
  function financials(E,lg,t){
    const roster=lg.teams[t].roster.map(id=>lg.players[id]).filter(p=>p&&!p.gone);
    return {enabled:E.capOn(lg),cap:E.CAP,payroll:E.capOn(lg)?E.payroll(lg,t):null,
      years:Array.from({length:5},(_,i)=>{const offset=i+1,underContract=roster.filter(p=>p.yrs>offset),committed=round(underContract.reduce((s,p)=>s+(p.sal||0),0));return {year:lg.year+offset,cap:E.CAP,committed,room:round(E.CAP-committed),signed:underContract.length,ending:roster.filter(p=>p.yrs===offset).length}}),
      ending:roster.filter(p=>p.yrs<=1).sort((a,b)=>a.yrs-b.yrs||b.grade-a.grade)};
  }
  function needs(E,lg,t){
    const L=E.lineup(lg,t),fa=E.freeAgents(lg).filter(p=>!p.inj&&!p.hold),room=E.capOn(lg)?E.CAP-E.payroll(lg,t):Infinity;
    return E.GROUPS.map(g=>{const starters=L[g],healthy=L.bench[g].length,missing=Math.max(0,E.STARTERS[g]-healthy),thin=Math.max(0,E.MINPOS[g]-healthy);
      const unit=starters.reduce((s,p)=>s+p.grade,0)/starters.length,weakest=Math.min(...starters.map(p=>p.grade)),best=fa.filter(p=>p.g===g&&p.grade>weakest).sort((a,b)=>b.grade-a.grade||E.askSalary(lg,a)-E.askSalary(lg,b));
      const affordable=best.find(p=>!E.capOn(lg)||E.askSalary(lg,p)<=room),weight=g==='QB'?1.25:['K','P'].includes(g)?.5:1;
      return {g,healthy,starters:E.STARTERS[g],missing,thin,unit,weakest,score:missing*10+thin*2+(10-unit)*weight,candidate:affordable||null,other:best[0]||null,ask:affordable?E.askSalary(lg,affordable):null,room};
    }).sort((a,b)=>b.score-a.score||E.GROUPS.indexOf(a.g)-E.GROUPS.indexOf(b.g));
  }
  function search(E,lg,query,group='ALL',where='all'){
    const q=query.trim().toLowerCase();return Object.values(lg.players).filter(p=>!p.gone&&(group==='ALL'||p.g===group)&&(where==='all'||where==='mine'&&p.team===lg.user||where==='fa'&&p.team<0)&&(!q||p.name.toLowerCase().includes(q))).sort((a,b)=>b.grade-a.grade||a.name.localeCompare(b.name));
  }
  return {financials,needs,search};
});
