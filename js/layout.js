// Time positions are authored independently of asset dimensions and collection size.
export function arrange(arts,width,height,duration,cue,gap=0,pixelsPerSecond=100){
 for(const a of arts){
  if(a.sizing==='viewport-height')a.scale=height/a.height*a.sizeFactor;
  const time=Number.isFinite(a.cueOffset)?cue+a.cueOffset:a.time;
  a.base=time*pixelsPerSecond+width*.5-a.width*a.scale/2;
 }
 return duration*pixelsPerSecond;
}
