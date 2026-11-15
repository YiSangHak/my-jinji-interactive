// cue.at is the fade START, not its midpoint.
// Absolute audio time makes forward and backward seeking yield the same palette.
export function backgroundMix(seconds, cue = {at:124, duration:0.4}) {
 const length=Math.max(0,Number(cue.duration)||0);
 if(!length)return seconds>=cue.at?1:0;
 const t=Math.max(0,Math.min(1,(seconds-cue.at)/length));
 return t*t*(3-2*t);
}
