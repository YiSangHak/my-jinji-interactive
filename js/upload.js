export function setupUpload({onAdd,onRemove,onOpen,onClose,getPlacement}){
 const dialog=document.getElementById('uploadDialog'),file=document.getElementById('uploadFile'),preview=document.getElementById('tracePreview'),original=document.getElementById('originalPreview'),message=document.getElementById('uploadMessage'),add=document.getElementById('addArtwork'),list=document.getElementById('addedArtworks');
 const worker=new Worker(new URL('./trace-worker.js',import.meta.url),{type:'module'});
 const controls=['threshold','detail','minArea','invert'].map(id=>document.getElementById(id));
 let pixels=null,width=0,height=0,sequence=0,result=null,sourceURL=null,previewURL=null,timer,fileToken=0,processing=false;
 function describePlacement(){const p=getPlacement();document.getElementById('placementNote').textContent=p.note.startsWith('Added just after')?'Placed after this scene.':'';}
 function render(){if(!pixels)return;processing=true;add.disabled=true;message.textContent='Loading…';const [threshold,detail,minArea,invert]=controls;worker.postMessage({id:++sequence,pixels,width,height,options:{threshold:Number(threshold.value),detail:Number(detail.value),minArea:Number(minArea.value),invert:invert.checked}});}
 worker.onmessage=({data})=>{if(data.id!==sequence)return;processing=false;if(data.error){message.textContent='Try another image.';return;}result=data;
 if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(new Blob([data.svg],{type:'image/svg+xml'}));preview.src=previewURL;preview.hidden=false;
 add.disabled=data.contours===0;message.textContent=data.contours===0?'No shapes found. Adjust light / dark or swap them.':data.coverage>.94?'Too much is filled. Try a lower light / dark setting.':'';
 describePlacement();};
 worker.onerror=()=>{processing=false;add.disabled=true;message.textContent='Could not start. Refresh and try again.';};
 async function chooseFile(selected){if(!selected)return;const token=++fileToken;sequence++;result=null;pixels=null;add.disabled=true;preview.hidden=true;
 if(!['image/jpeg','image/png','image/webp'].includes(selected.type)){message.textContent='Choose a JPG, PNG or WebP image.';return;}
 if(selected.size>20*1024*1024){message.textContent='Choose an image under 20 MB.';return;}
 try{message.textContent='Opening image…';const url=URL.createObjectURL(selected),img=new Image();img.src=url;try{await img.decode();}catch(error){URL.revokeObjectURL(url);throw error;}
 if(token!==fileToken){URL.revokeObjectURL(url);return;}if(sourceURL)URL.revokeObjectURL(sourceURL);sourceURL=url;original.src=url;original.hidden=false;document.getElementById('changePhoto').textContent='Change photo';
 const scale=Math.min(1,320/Math.max(img.naturalWidth,img.naturalHeight));width=Math.max(1,Math.round(img.naturalWidth*scale));height=Math.max(1,Math.round(img.naturalHeight*scale));
 const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,width,height);pixels=ctx.getImageData(0,0,width,height).data;
 document.getElementById('traceControls').disabled=false;render();
 }catch(error){message.textContent='Could not open this image. Try another.';}}
 file.onchange=()=>chooseFile(file.files[0]);
 file.onclick=()=>{file.value='';};
 document.getElementById('changePhoto').onclick=()=>file.click();
 for(const c of controls)c.oninput=()=>{sequence++;clearTimeout(timer);timer=setTimeout(render,140);add.disabled=true;};
 document.getElementById('openUpload').onclick=()=>{onOpen();dialog.showModal();describePlacement();};
 document.getElementById('closeUpload').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{document.getElementById('stage').focus({preventScroll:true});onClose();});
 const drop=document.getElementById('uploadDrop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('over');};drop.ondragleave=()=>drop.classList.remove('over');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');chooseFile(e.dataTransfer.files[0]);};
 add.onclick=async()=>{if(!result||processing)return;add.disabled=true;
 try{const id=await onAdd({source:result.svg,width:result.width,height:result.height,size:Number(document.getElementById('uploadSize').value)});
 const row=document.createElement('li'),label=document.createElement('span'),remove=document.createElement('button');label.textContent='Your artwork';remove.textContent='Remove';remove.onclick=()=>{onRemove(id);row.remove();};row.append(label,remove);list.append(row);message.textContent='Added. Refreshing clears it.';dialog.close();
 }catch(error){message.textContent=error.message||'Could not add it. Try again.';}finally{add.disabled=!result||result.contours===0;}};
}
