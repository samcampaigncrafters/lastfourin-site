/* Presentation frequency never changes the simulation's unanswered defaults. */
(function(root){
  const tiers = [
    {name:"Watch",detail:"Your staff handles every decision. No coaching stops."},
    {name:"Big Moments",detail:"Key third downs, red-zone plays, fourth downs, two-point tries and late clock choices."},
    {name:"Play Calling",detail:"Call offense and defensive packages each snap. Staff handles presnap reads."},
    {name:"Full Control",detail:"Call, read the defense, audible or take a timeout. Defense gets one counter after an adjustment."}
  ];
  const valid = n => Number.isInteger(n) && n>=0 && n<tiers.length;
  function prompts(a,level){
    if (!valid(level) || level===0) return false;
    if (["look","huddle","reply","reset"].includes(a.kind)) return level===3;
    if (["play","def"].includes(a.kind)) {
      if(level>=2)return true;
      return a.dn===3&&a.tg<=3&&(a.yl>=50||a.q===4) || a.dn===1&&a.yl>=90 || a.dn===1&&a.q===4&&a.clock<=120&&Math.abs(a.diff)<=8;
    }
    return true;
  }
  const api={tiers,valid,prompts};
  if(typeof module==="object"&&module.exports)module.exports=api;else root.FranchiseCoachingControls=api;
})(typeof self!=="undefined"?self:this);
