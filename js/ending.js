// No anticipation or fade: blackout starts on the media's actual ended event.
export function setupEnding(audio,blackout,onEnd){
 audio.addEventListener('ended',()=>{onEnd();blackout.hidden=false;});
 for(const event of ['seeking','play'])audio.addEventListener(event,()=>{blackout.hidden=true;});
}
