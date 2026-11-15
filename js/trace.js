// Small, bounded binary contour tracer. Photographs become editable silhouette paths.
function distance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;if(!d)return Math.hypot(p[0]-a[0],p[1]-a[1]);const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
function simplify(points,tolerance){
 if(points.length<=2)return points;
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]];
 while(stack.length){const [a,b]=stack.pop();let max=tolerance,idx=-1;for(let i=a+1;i<b;i++){const d=distance(points[i],points[a],points[b]);if(d>max){max=d;idx=i;}}if(idx>=0){keep[idx]=1;stack.push([a,idx],[idx,b]);}}
 return points.filter((_,i)=>keep[i]);
}
function closedSimplify(points,tolerance){let far=1,max=0;for(let i=1;i<points.length;i++){const d=Math.hypot(points[i][0]-points[0][0],points[i][1]-points[0][1]);if(d>max){max=d;far=i;}}return [...simplify(points.slice(0,far+1),tolerance).slice(0,-1),...simplify([...points.slice(far),points[0]],tolerance).slice(0,-1)];}
export function traceRGBA(rgba,w,h,{threshold=145,invert=false,detail=1.4,minArea=18}={}){
 const mask=new Uint8Array(w*h);let filled=0;
 for(let i=0;i<mask.length;i++){const k=i*4,l=.2126*rgba[k]+.7152*rgba[k+1]+.0722*rgba[k+2];mask[i]=rgba[k+3]>80&&(invert?l>threshold:l<threshold)?1:0;filled+=mask[i];}
 const stride=w+1,edges=new Map();let total=0;
 const add=(x,y,tx,ty,dir)=>{const key=y*stride+x;if(!edges.has(key))edges.set(key,[]);edges.get(key).push({to:ty*stride+tx,dir});total++;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!mask[y*w+x])continue;if(y===0||!mask[(y-1)*w+x])add(x,y,x+1,y,0);if(x===w-1||!mask[y*w+x+1])add(x+1,y,x+1,y+1,1);if(y===h-1||!mask[(y+1)*w+x])add(x+1,y+1,x,y+1,2);if(x===0||!mask[y*w+x-1])add(x,y+1,x,y,3);}
 const contours=[];
 while(edges.size){const start=edges.keys().next().value,points=[];let key=start,previous=0,steps=0;
 do{points.push([key%stride,Math.floor(key/stride)]);const choices=edges.get(key);if(!choices?.length)break;
 let choice=0;if(choices.length>1){const ranks={1:0,0:1,3:2,2:3};for(let i=1;i<choices.length;i++)if(ranks[(choices[i].dir-previous+4)%4]<ranks[(choices[choice].dir-previous+4)%4])choice=i;}
 const edge=choices.splice(choice,1)[0];if(!choices.length)edges.delete(key);previous=edge.dir;key=edge.to;steps++;
 }while(key!==start&&steps<=total);
 if(key!==start||points.length<4)continue;
 let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}
 if(Math.abs(area/2)<minArea)continue;
 const clean=closedSimplify(points,detail);if(clean.length>=3)contours.push(clean);
 }
 const path=contours.map(points=>'M'+points.map(p=>p.join(' ')).join('L')+'Z').join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="upload-fill" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#EEF2CE"/><stop offset="1" stop-color="#9CC1D9"/></linearGradient></defs><path d="${path}" fill="url(#upload-fill)" fill-rule="evenodd" stroke="black" stroke-width="0.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
 return {svg,contours:contours.length,coverage:filled/(w*h),points:contours.reduce((n,c)=>n+c.length,0),width:w,height:h};
}
