// Offset shifts all cues later when positive. Intervals exclude the ending instant.
export function activeLyric(lines,seconds,offset=0){
 const t=seconds-offset;
 let lo=0,hi=lines.length-1,index=-1;
 while(lo<=hi){const mid=(lo+hi)>>1;if(lines[mid].start<=t){index=mid;lo=mid+1;}else hi=mid-1;}
 const cue=lines[index];
 if(!cue||t>=cue.end)return null;
 const fade=Math.min(1,Math.max(0,(t-cue.start)/.18),Math.max(0,(cue.end-t)/.24));
 return {index,text:cue.text,opacity:fade};
}
