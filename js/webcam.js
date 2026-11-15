// Camera pixels never leave this browser. Model and runtime are served locally.
export function roughAlpha(confidence, x, y, reveal=1) {
 const block=Math.sin(Math.floor(x/3)*127.1+Math.floor(y/3)*311.7)*43758.5453;
 const noise=block-Math.floor(block);
 return noise>=reveal?0:Math.max(0,Math.min(1,(confidence-(.48+noise*.16))/.12))*255;
}
// Two intentionally distinct treatments; never recolor the original artwork layer.
export function tintCamera(pixels,mode='film',strength=.8,phase=0){
 const data=pixels.data,original=new Uint8ClampedArray(data),w=pixels.width,h=pixels.height;
 const palette=[[157,192,222],[239,211,208],[221,226,184],[217,119,145]];
 const luminance=i=>(original[i]*.299+original[i+1]*.587+original[i+2]*.114)/255;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(!data[i+3])continue;const l=luminance(i);let color;
  if(mode==='artwork'){
   const t=Math.round(l*3)/3,flow=x/Math.max(w-1,1),a=palette[Math.min(2,Math.floor(flow*3))],b=palette[Math.min(3,Math.floor(flow*3)+1)],mix=flow*3%1;
   color=a.map((c,j)=>(c+(b[j]-c)*mix)*(.72+t*.28));
   const edge=x+1<w&&y+1<h?Math.max(Math.abs(l-luminance(i+4)),Math.abs(l-luminance(i+w*4))):0;
   if(edge>.15)color=[58,64,71];
  }else{
   const grain=(Math.sin(x*12.9898+y*78.233+phase)*43758.5453%1)*2;
   color=[l*174+45+(original[i]-l*255)*.32+grain,l*171+38+(original[i+1]-l*255)*.28+grain,l*180+49+(original[i+2]-l*255)*.34+grain];
  }
  for(let j=0;j<3;j++)data[i+j]=original[i+j]*(1-strength)+color[j]*strength;
 }
 return pixels;
}
// Hit test the mirrored, visible foreground rather than its transparent rectangle.
export function cameraHit(pixels,bounds,x,y,reveal=1){
 const u=(x-bounds.x)/bounds.w,v=(y-bounds.y)/bounds.h;
 if(u<0||u>=1||v<0||v>=1)return false;
 const px=Math.min(pixels.width-1,Math.floor((1-u)*pixels.width)),py=Math.floor(v*pixels.height);
 // Small tolerance makes rough cutout edges easy to catch.
 for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){
  const sx=px+ox,sy=py+oy;if(sx<0||sy<0||sx>=pixels.width||sy>=pixels.height)continue;
  if(pixels.data[(sy*pixels.width+sx)*4+3]>80&&roughAlpha(1,Math.floor(sx/6)*6,Math.floor(sy/6)*6,reveal)>0)return true;
 }
 return false;
}
export function setupWebcam({supported=true}={}) {
 const button=document.getElementById('openCamera'),label=button.querySelector('span');
 let userChoice=false,entryStarted=false;
 let position={x:.58,y:.58},bounds=null,moving=null,hitPixels=null;
 function hit(x,y){
  if(!active||!hasFrame||!bounds||!hitPixels)return false;
  return cameraHit(hitPixels,bounds,x,y,reveal);
 }
 const video=document.createElement('video');video.muted=true;video.playsInline=true;
 const capture=document.createElement('canvas');capture.width=192;capture.height=144;
 const ctx=capture.getContext('2d',{willReadFrequently:true});
 const cutout=document.createElement('canvas');cutout.width=192;cutout.height=144;
 const out=cutout.getContext('2d');
 let segmenter,modelPromise,stream,active=false,pending=false,generation=0,frameTime=-1,lastInference=0,reveal=0,hasFrame=false;
 const setMessage=text=>{button.title=text;};
 function controls(){
  button.dataset.active=String(active);button.setAttribute('aria-checked',String(active));button.setAttribute('aria-busy',String(pending));
  button.setAttribute('aria-label',active?'Turn camera off':pending?'Cancel camera':'Turn camera on');
  label.textContent=pending?'CAM …':active?'CAM ON':'CAM OFF';button.title=active?'Turn camera off':pending?'Cancel camera':'Turn camera on';
 }
 function stopCamera(){moving=null;generation++;pending=false;active=false;stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;controls();}
 async function loadModel(){
  if(!modelPromise)modelPromise=(async()=>{
   const {FilesetResolver,ImageSegmenter}=await import('../vendor/mediapipe/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks(new URL('../vendor/mediapipe/wasm',import.meta.url).href);
   return ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('../vendor/mediapipe/selfie_segmenter_landscape.tflite',import.meta.url).href},runningMode:'VIDEO',outputConfidenceMasks:true,outputCategoryMask:false});
  })().catch(error=>{modelPromise=null;throw error;});
  return modelPromise;
 }
 async function startCamera(){
  if(active||pending||!supported)return;
  const id=++generation;pending=true;controls();setMessage('Connecting camera…');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('UNSUPPORTED');
   // Request video on entry or toggle; browser permission remains required. No microphone.
   const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:320},height:{ideal:240}}});
   if(id!==generation){next.getTracks().forEach(t=>t.stop());return;}
   stream=next;video.srcObject=stream;await video.play();segmenter=await loadModel();
   if(id!==generation)return;
   stream.getVideoTracks()[0]?.addEventListener('ended',stopCamera,{once:true});
   active=true;pending=false;frameTime=-1;lastInference=0;reveal=0;hasFrame=false;controls();
  }catch(error){if(id!==generation)return;stopCamera();setMessage(error.name==='NotAllowedError'?'Allow camera access in your browser.':error.name==='NotFoundError'?'No camera found.':'Could not start the camera. Try localhost or HTTPS.');console.warn('Webcam unavailable',error);}
 }
 button.addEventListener('click',()=>{userChoice=true;if(active||pending)stopCamera();else void startCamera();});
 addEventListener('pagehide',()=>{stopCamera();segmenter?.close();segmenter=null;modelPromise=null;});
 button.disabled=!supported;if(!supported)button.title='This browser does not support the water effect.';
 controls();
 return {
  stop:stopCamera,
  startOnEntry(){if(entryStarted)return;entryStarted=true;if(!userChoice)void startCamera();},
  pointerDown(e){
   if(moving||!hit(e.clientX,e.clientY))return false;
   moving={id:e.pointerId,x:e.clientX,y:e.clientY,px:position.x,py:position.y};return true;
  },
  pointerMove(e){
   if(!moving||moving.id!==e.pointerId)return false;
   position.x=Math.max(0,Math.min(1-bounds.w/innerWidth,moving.px+(e.clientX-moving.x)/innerWidth));
   position.y=Math.max(0,Math.min(1-bounds.h/innerHeight,moving.py+(e.clientY-moving.y)/innerHeight));
   return true;
  },
  pointerUp(e){if(!moving||moving.id!==e.pointerId)return false;moving=null;return true;},
  cursor(x,y){return moving?'grabbing':hit(x,y)?'grab':'default';},
  draw(target,width,height,now,dt){
   reveal=Math.max(0,Math.min(1,reveal+(active?dt/.8:-dt/.7)));
   if(active&&video.readyState>=2&&now-lastInference>100&&video.currentTime!==frameTime){
    lastInference=now;frameTime=video.currentTime;
    try{
     ctx.drawImage(video,0,0,192,144);
     segmenter.segmentForVideo(capture,now,result=>{
      // Selfie segmenter's single confidence channel is foreground probability.
      const mask=result.confidenceMasks?.[0];if(!mask)return;
      const values=mask.getAsFloat32Array(),pixels=ctx.getImageData(0,0,192,144);
      for(let y=0;y<144;y++)for(let x=0;x<192;x++){
       const index=y*192+x,m=Math.floor(y*mask.height/144)*mask.width+Math.floor(x*mask.width/192);
       pixels.data[index*4+3]=roughAlpha(values[m],x,y);
      }
      tintCamera(pixels,'film',.8,Math.floor(now/100));
      out.putImageData(pixels,0,0);hitPixels=pixels;hasFrame=true;
     });
    }catch(error){stopCamera();setMessage('Camera effect stopped. Turn it on to try again.');console.warn('Segmentation stopped',error);}
   }
   if(!hasFrame||reveal<=0)return;
   const h=height*.20,w=h*4/3;
   position.x=Math.max(0,Math.min(1-w/width,position.x));position.y=Math.max(0,Math.min(1-h/height,position.y));
   const x=width*position.x,y=height*position.y;bounds={x,y,w,h};
   target.save();target.imageSmoothingEnabled=false;target.translate(x+w,y);target.scale(-1,1);
   // Reveal irregular blocks without duplicating or scattering the person.
   if(reveal>=1)target.drawImage(cutout,0,0,w,h);
   else for(let by=0;by<144;by+=6)for(let bx=0;bx<192;bx+=6){
    if(roughAlpha(1,bx,by,reveal)>0)target.drawImage(cutout,bx,by,6,6,bx/192*w,by/144*h,6/192*w,6/144*h);
   }
   target.restore();
  }
 };
}
