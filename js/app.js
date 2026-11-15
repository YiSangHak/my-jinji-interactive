// Independent original SVG assets. Scale is uniform; source geometry is never edited.
import {createWater} from './water.js';
import {setupUpload} from './upload.js';
import {setupWebcam} from './webcam.js';
import {arrange} from './layout.js';
import {deformArtwork,spreadArtwork,drawArtwork} from './paint.js';
import {displayImage} from './strokes.js';
import {backgroundMix} from './timeline.js';
import {activeLyric} from './lyrics.js';
import {setupEnding} from './ending.js';
import {setupStory} from './story.js';
setupStory();
const lyricConfig=await (await fetch(new URL('../data/lyrics.json',import.meta.url))).json();
const lyricElement=document.getElementById('lyric');
let lyricIndex=-1;
const sceneConfig=await (await fetch(new URL('../data/scene.json',import.meta.url))).json();
const initial=sceneConfig.artworks;
const waterCanvas=document.getElementById('water');
let water;try{water=createWater(waterCanvas);}catch(error){console.warn('Water unavailable',error);}
const surface=document.createElement('canvas'),surfaceCtx=surface.getContext('2d');
const webcam=setupWebcam({supported:Boolean(water)});
document.body.classList.toggle('water-lyrics',Boolean(water));
let lyricLayout=null;
function invalidateLyricLayout(){lyricLayout=null;}
addEventListener('resize',invalidateLyricLayout);
document.fonts.ready.then(invalidateLyricLayout);
document.fonts.addEventListener('loadingdone',invalidateLyricLayout);
function drawUnderwaterLyric(lyric){
 if(!lyric||lyric.opacity<=0)return;
 if(!lyricLayout){
  const box=lyricElement.parentElement.getBoundingClientRect(),style=getComputedStyle(lyricElement);
  lyricLayout={box,font:`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,size:parseFloat(style.fontSize),color:style.color,spacing:style.letterSpacing};
 }
 const l=lyricLayout,ctx=surfaceCtx;
 ctx.save();ctx.font=l.font;if('letterSpacing'in ctx)ctx.letterSpacing=l.spacing;
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=l.color;
 const lines=[];let line='';
 for(const word of lyric.text.split(' ')){
  const trial=line?line+' '+word:word;
  if(line&&ctx.measureText(trial).width>l.box.width){lines.push(line);line=word;}else line=trial;
 }if(line)lines.push(line);
 const lineHeight=l.size*1.2,top=l.box.bottom-lines.length*lineHeight;
 ctx.globalAlpha=lyric.opacity;ctx.shadowColor='#f4e9e6aa';ctx.shadowBlur=12*dpr;ctx.shadowOffsetY=1*dpr;
 lines.forEach((text,i)=>ctx.fillText(text,l.box.left+l.box.width/2,top+(i+.5)*lineHeight));
 ctx.restore();
}

// Original Figma palette, repeated in panorama space rather than stretched across the song.
const backgroundFlow=sceneConfig.backgroundFlow;
const cycleWidth=backgroundFlow.cycleWidth;
for(const [index,name] of ['light','deep'].entries()){
 const palette=backgroundFlow[name],layer=document.querySelector('.'+name);
 layer.style.backgroundImage=`linear-gradient(90deg,${palette[0]} 0%,${palette[1]} 50%,${palette[0]} 100%)`;
 layer.style.backgroundSize=cycleWidth+'px 100%';
}
function paintBackground(context,palette,offset){
 const first=-(offset%cycleWidth);
 for(let x=first;x<width;x+=cycleWidth){
  const gradient=context.createLinearGradient(x,0,x+cycleWidth,0);
  gradient.addColorStop(0,palette[0]);gradient.addColorStop(.5,palette[1]);gradient.addColorStop(1,palette[0]);
  context.fillStyle=gradient;context.fillRect(x,0,cycleWidth+.5,height);
 }
}
const ripples=[];
let lastRipple=0,previewTime=null,seekTimer,displayTime=0;
function addRipple(x,y,power=1,force=false){const now=performance.now();if(!force&&now-lastRipple<90)return;lastRipple=now;ripples.push({x,y,age:0,power});if(ripples.length>16)ripples.shift();}
const $=id=>document.getElementById(id), stage=$('stage');
const audio=$('audio'), status=$('status');
const state={gap:0,strength:.6,depth:0,auto:true,offset:0,phase:0,ready:false};
let width=innerWidth,height=innerHeight,dpr=1,last=0,drag=false,audioContext,analyser,gain,bins,energy=0;
const arts=[],userArts=[];let pressure=0;
function resize(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);if(state.ready)layout();}
addEventListener('resize',resize);resize();
// Audio and the scene share one transport; the page opens still and silent.
const FADE_SECONDS=.28;
let wantsPlayback=false,requestId=0,pauseTimer;
const envelope={from:0,to:0,start:performance.now()};
function transportLevel(now=performance.now()){
 const t=Math.min(1,Math.max(0,(now-envelope.start)/(FADE_SECONDS*1000)));
 return envelope.from+(envelope.to-envelope.from)*t;
}
function fadeTo(target){
 const now=performance.now(),current=transportLevel(now);
 Object.assign(envelope,{from:current,to:target,start:now});
 if(gain){const t=audioContext.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(current,t);gain.gain.linearRampToValueAtTime(target,t+FADE_SECONDS);}
}
function playState(){document.body.dataset.playing=String(wantsPlayback);}
function finishEntry(){const entry=document.getElementById('entry');if(entry.hidden||entry.classList.contains('leaving'))return;entry.classList.add('leaving');document.body.classList.add('entered');setTimeout(()=>{entry.hidden=true;stage.focus({preventScroll:true});},700);if(document.getElementById('introCamera').checked)webcam.startOnEntry();}
function offerEntry(message='Enter with sound'){
 document.getElementById('entry').hidden=false;document.getElementById('entry').classList.remove('leaving');document.getElementById('loadingText').textContent=message;document.getElementById('enter').disabled=false;
}
async function togglePlayback(automatic=false){
 if(!state.ready)return;
 const id=++requestId;wantsPlayback=!wantsPlayback;clearTimeout(pauseTimer);playState();
 if(!wantsPlayback){
  fadeTo(0);pauseTimer=setTimeout(()=>{if(id===requestId&&!wantsPlayback)audio.pause();},FADE_SECONDS*1000);
  return;
 }
 try{
  if(!audioContext){
   audioContext=new AudioContext();analyser=audioContext.createAnalyser();gain=audioContext.createGain();gain.gain.value=0;
   analyser.fftSize=512;analyser.smoothingTimeConstant=.85;
   audioContext.createMediaElementSource(audio).connect(gain);gain.connect(analyser);analyser.connect(audioContext.destination);
   bins=new Uint8Array(analyser.frequencyBinCount);
  }
  const resume=audioContext.resume();
  let timeout;
  try{await Promise.race([Promise.all([resume,audio.play()]),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new DOMException('Playback needs user activation','NotAllowedError')),1500);})]);}finally{clearTimeout(timeout);}
if(id!==requestId){if(!wantsPlayback)audio.pause();return;}
  fadeTo(1);setStatus('');finishEntry();
 }catch(error){
  if(id!==requestId)return;
  wantsPlayback=false;fadeTo(0);audio.pause();playState();
  if(error.name==='NotAllowedError'){offerEntry();}else{console.error(error);offerEntry('Could not play. Tap Enter to try again.');}
 }
}
function stopTransport(){clearTimeout(pauseTimer);++requestId;wantsPlayback=false;fadeTo(0);playState();}
document.addEventListener('keydown',event=>{
 if(event.code!=='Space'||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
 // Let text fields, sliders, selects and other buttons retain native keyboard behavior.
 if(event.target.closest('input,textarea,select,[contenteditable],button,a,dialog[open]'))return;
 event.preventDefault();togglePlayback(false);
});
document.getElementById('enter').onclick=()=>{if(!wantsPlayback)togglePlayback(false);};
audio.addEventListener('pause',()=>{if(wantsPlayback)stopTransport();});
setupEnding(audio,document.getElementById('blackout'),()=>{stopTransport();webcam.stop();document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());});
audio.addEventListener('waiting',()=>fadeTo(0));
audio.addEventListener('playing',()=>{if(wantsPlayback)fadeTo(1);});
playState();
let renderTimer;
async function loadArt(config,index){
 const source=config.source??await (await fetch(new URL('../'+config.file,import.meta.url))).text();
 const scale=config.sizing==='viewport-height'?height/config.height*config.scale:config.scale;
 const img=await displayImage(source,config.width*scale,config.height*scale,sceneConfig.strokeWidth,dpr);
 img.className='art';img.alt=config.name;img.draggable=false;img.style.width=config.width+'px';img.style.height=config.height+'px';
 $('artworks').append(img);if(water)img.style.visibility='hidden';
 return {...config,source,sizeFactor:config.scale,scale,img,index,screenX:0,screenY:0,renderScale:scale,renderDpr:dpr,renderVersion:0};
}
function refreshStrokeDisplays(){
 clearTimeout(renderTimer);renderTimer=setTimeout(()=>{
 for(const a of [...arts,...userArts]){if(a.renderScale===a.scale&&a.renderDpr===dpr)continue;
 const version=++a.renderVersion,scale=a.scale,density=dpr;
 displayImage(a.source,a.width*scale,a.height*scale,sceneConfig.strokeWidth,density).then(img=>{
 if(version!==a.renderVersion)return;
 img.className='art';img.alt=a.name;img.draggable=false;img.style.width=a.width+'px';img.style.height=a.height+'px';
 img.style.visibility=water?'hidden':'visible';a.img.replaceWith(img);a.img=img;if(a.ink)a.ink.dirty=true;a.renderScale=scale;a.renderDpr=density;

 }).catch(error=>{console.error(error);setStatus('Could not update the artwork. Please refresh.');});
 }
 },80);
}
function layout(){
 state.length=arrange(arts,width,height,duration()||400.58,sceneConfig.backgroundTransition.at,state.gap,sceneConfig.transport.pixelsPerSecond);
 for(const a of userArts){a.scale=height/a.height*a.sizeFactor;a.base=a.anchorTime/(duration()||400.58)*state.length+width*.5-a.width*a.scale/2;}
 refreshStrokeDisplays();
}
function duration(){return Number.isFinite(audio.duration)?audio.duration:0;}
function seekTime(target){
 if(!duration())return;
 previewTime=Math.max(0,Math.min(duration(),target));clearTimeout(seekTimer);
 if(gain){const t=audioContext.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(gain.gain.value,t);gain.gain.linearRampToValueAtTime(0,t+.07);}
 seekTimer=setTimeout(()=>{
 const destination=previewTime;
 if(destination===null)return;
 if(Math.abs(audio.currentTime-destination)<.015&&!audio.seeking){previewTime=null;if(wantsPlayback)fadeTo(1);return;}
 // Keep the requested time visible until the media confirms the seek; Chrome can report 0 while loading a range.
 audio.currentTime=destination;
 },100);
}
// Scroll changes time, never duplicates artwork. Dragging remains a water gesture.
stage.addEventListener('wheel',e=>{if(!state.ready||!duration()||e.ctrlKey)return;e.preventDefault();const delta=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?20:e.deltaMode===2?height:1);seekTime((previewTime??audio.currentTime)+delta/state.length*duration());document.body.classList.add('explored');},{passive:false});
audio.addEventListener('seeked',()=>{if(previewTime!==null&&Math.abs(audio.currentTime-previewTime)>.5)return;previewTime=null;if(wantsPlayback)fadeTo(1);});
function setStatus(message){status.textContent=message;}
let loadedCount=0;
Promise.all(initial.map(async config=>{const art=await loadArt(config,initial.indexOf(config));document.getElementById('loadingText').textContent=`Loading · ${++loadedCount} / ${initial.length}`;return art;})).then(async loaded=>{
 arts.push(...loaded);layout();state.ready=true;document.getElementById('openUpload').disabled=false;
 if(audio.readyState<2)await new Promise(resolve=>{const done=()=>{clearTimeout(timer);audio.removeEventListener('loadeddata',done);resolve();};const timer=setTimeout(done,6000);audio.addEventListener('loadeddata',done,{once:true});});
 document.getElementById('loadingText').textContent='';
 document.getElementById('enter').disabled=false;
}).catch(error=>{console.error(error);document.getElementById('loadingText').textContent='Could not load. Please refresh.';});
let pointer={x:0,y:0},heldSeconds=0,spreadStep=0;
addEventListener('blur',()=>{drag=false;heldSeconds=0;spreadStep=0;});
stage.addEventListener('pointerdown',e=>{
 if(!state.ready)return;
 if(webcam.pointerDown(e)){e.preventDefault();stage.setPointerCapture(e.pointerId);stage.style.cursor='grabbing';return;}
 drag=true;heldSeconds=0;spreadStep=0;pointer={x:e.clientX,y:e.clientY};document.body.classList.add('explored');
 stage.setPointerCapture(e.pointerId);addRipple(e.clientX,e.clientY,.8,true);
});
stage.addEventListener('pointermove',e=>{
 if(webcam.pointerMove(e)){stage.style.cursor='grabbing';return;}
 stage.style.cursor=webcam.cursor(e.clientX,e.clientY);
 const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
 const distance=Math.hypot(dx,dy);
 if(drag&&water&&distance>0){for(const a of [...arts,...userArts])deformArtwork(a,e.clientX,e.clientY,dx,dy);}
 pointer={x:e.clientX,y:e.clientY};
 if(distance>5)addRipple(e.clientX,e.clientY,drag?.65:.12);
});
function releaseWater(e){if(webcam.pointerUp(e)){pointer={x:e.clientX??pointer.x,y:e.clientY??pointer.y};stage.style.cursor=webcam.cursor(pointer.x,pointer.y);return;}if(drag){addRipple(pointer.x,pointer.y,1.25,true);}drag=false;}
for(const event of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(event,releaseWater);
function updateDuration(){if(state.ready)layout();}
audio.addEventListener('loadedmetadata',updateDuration);audio.addEventListener('durationchange',updateDuration);updateDuration();
audio.addEventListener('error',()=>{stopTransport();audio.pause();setStatus('Could not load the music.');});
document.addEventListener('visibilitychange',()=>{last=0;});
function tick(now){const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(analyser&&!audio.paused){analyser.getByteFrequencyData(bins);let sum=0;for(let i=0;i<bins.length;i++)sum+=bins[i];energy=sum/bins.length/255;}else energy*=.95;
const flowDt=dt;
if(state.ready){
 const targetTime=previewTime??audio.currentTime;
 const lyric=activeLyric(lyricConfig.lines,targetTime,lyricConfig.offset);
 if((lyric?.index??-1)!==lyricIndex){lyricIndex=lyric?.index??-1;lyricElement.textContent=lyric?.text??'';invalidateLyricLayout();}
 lyricElement.style.opacity=lyric?.opacity??0;

 // Very short visual easing also softens seeks; media time stays the authoritative clock.
 displayTime+=(targetTime-displayTime)*(1-Math.exp(-dt*22));
 if(Math.abs(targetTime-displayTime)<.001)displayTime=targetTime;
 const progress=duration()?Math.max(0,Math.min(1,displayTime/duration())):0;
 state.offset=progress*state.length;
 stage.dataset.progress=progress.toFixed(6);
 stage.dataset.backgroundMix=state.auto?backgroundMix(targetTime,sceneConfig.backgroundTransition).toFixed(4):String(state.depth);
 if(state.auto){state.depth=backgroundMix(targetTime,sceneConfig.backgroundTransition);}
 document.querySelector('.deep').style.opacity=state.depth;
 const bgX=-(state.offset%cycleWidth);
 stage.dataset.backgroundPhase=((-bgX)/cycleWidth).toFixed(4);
 document.querySelectorAll('.background').forEach(b=>b.style.backgroundPosition=bgX+'px center');
for(const a of [...arts,...userArts]){a.screenX=a.base-state.offset;a.screenY=height*a.y-a.height*a.scale/2;a.img.style.transform=`translate(${a.screenX}px,${a.screenY}px) scale(${a.scale})`;}
 if(drag&&water&&!audio.ended){
  heldSeconds+=dt;spreadStep+=dt;
  // Update at 30 Hz, accumulating elapsed time rather than pointer-event count.
  if(spreadStep>=1/30){for(const a of [...arts,...userArts])spreadArtwork(a,pointer.x,pointer.y,spreadStep,heldSeconds);spreadStep=0;}
 }else{heldSeconds=0;spreadStep=0;}
 pressure+=((drag?1:0)-pressure)*(1-Math.exp(-dt*14));
 if(water){
 if(surface.width!==Math.round(width*dpr)||surface.height!==Math.round(height*dpr)){surface.width=Math.round(width*dpr);surface.height=Math.round(height*dpr);}
 surfaceCtx.setTransform(dpr,0,0,dpr,0,0);surfaceCtx.clearRect(0,0,width,height);
 surfaceCtx.globalAlpha=1;paintBackground(surfaceCtx,backgroundFlow.light,state.offset);
 surfaceCtx.globalAlpha=state.depth;paintBackground(surfaceCtx,backgroundFlow.deep,state.offset);surfaceCtx.globalAlpha=1;
 for(const a of [...arts,...userArts]){if(a.screenX+a.width*a.scale<0||a.screenX>width)continue;drawArtwork(surfaceCtx,a,dpr);}
 webcam.draw(surfaceCtx,width,height,now,dt);
 drawUnderwaterLyric(lyric);
 for(let i=ripples.length-1;i>=0;i--){ripples[i].age+=dt;if(ripples[i].age>3)ripples.splice(i,1);}
 water.draw(surface,ripples,dpr,{...pointer,pressure});
 }else{waterCanvas.hidden=true;}
 }

requestAnimationFrame(tick);}requestAnimationFrame(tick);

let resumeAfterUpload=false;
function uploadPlacement(){
 let time=previewTime??audio.currentTime,note='Added here in the scene.';
 for(const a of arts.filter(a=>a.solo)){
  const start=(a.base-width)/state.length*(duration()||400.58),end=(a.base+a.width*a.scale)/state.length*(duration()||400.58);
  if(time>=start&&time<=end){time=Math.min(duration()||400.58,end+3);note='Added just after this scene. We’ll take you there.';}
 }
 return {time,note};
}
setupUpload({
 getPlacement:uploadPlacement,
 onOpen(){resumeAfterUpload=wantsPlayback;if(wantsPlayback)togglePlayback(false);},
 onClose(){if(resumeAfterUpload&&!wantsPlayback)togglePlayback(false);resumeAfterUpload=false;},
 async onAdd(config){
  if(userArts.length>=8)throw Error('Up to 8 images. Remove one to add another.');
  const id=crypto.randomUUID(),placement=uploadPlacement();
  const art=await loadArt({...config,id,name:'Your artwork',sizing:'viewport-height',scale:config.size,y:.5,anchorTime:placement.time,uploaded:true},arts.length+userArts.length);
  userArts.push(art);layout();stage.dataset.uploadedCount=String(userArts.length);
  if(Math.abs(placement.time-audio.currentTime)>.5)seekTime(placement.time);
  return id;
 },
 onRemove(id){const index=userArts.findIndex(a=>a.id===id);if(index<0)return;const [art]=userArts.splice(index,1);art.renderVersion++;art.img.remove();stage.dataset.uploadedCount=String(userArts.length);}
});
