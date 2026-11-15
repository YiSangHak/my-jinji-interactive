// Session-only, artwork-local displacement. Source SVGs and lyrics are never modified.
const COLS=24,ROWS=18,MAX_SHIFT=48,RADIUS=110;
export function deformArtwork(art,x,y,dx,dy){
 const w=art.width*art.scale,h=art.height*art.scale;
 const px=x-art.screenX,py=y-art.screenY;
 if(px< -RADIUS||py< -RADIUS||px>w+RADIUS||py>h+RADIUS)return false;
 if(!art.ink)art.ink={points:Array.from({length:(COLS+1)*(ROWS+1)},()=>({x:0,y:0})),dirty:true};
 let changed=false;
 art.ink.points.forEach((p,i)=>{
  const vx=(i%(COLS+1))/COLS*w+p.x*w,vy=Math.floor(i/(COLS+1))/ROWS*h+p.y*h;
  const d=Math.hypot(px-vx,py-vy);if(d>=RADIUS)return;
  const weight=(1-d/RADIUS)**2*.42;
  let nx=p.x*w+dx*weight,ny=p.y*h+dy*weight;
  const length=Math.hypot(nx,ny),limit=Math.min(MAX_SHIFT,Math.min(w,h)*.18);
  if(length>limit){nx*=limit/length;ny*=limit/length;}
  p.x=nx/w;p.y=ny/h;changed=true;
 });
 if(changed)art.ink.dirty=true;return changed;
}
// A stationary press adds radial flow, progressively reaching nearby mesh points.
export function spreadArtwork(art,x,y,seconds,heldSeconds=0){
 if(seconds<=0)return false;
 const w=art.width*art.scale,h=art.height*art.scale;
 const px=x-art.screenX,py=y-art.screenY;
 const radius=RADIUS+Math.min(heldSeconds,4)*27.5;
 if(px< -radius||py< -radius||px>w+radius||py>h+radius)return false;
 if(!art.ink)art.ink={points:Array.from({length:(COLS+1)*(ROWS+1)},()=>({x:0,y:0})),dirty:true};
 let changed=false;
 art.ink.points.forEach((p,i)=>{
  const vx=(i%(COLS+1))/COLS*w+p.x*w,vy=Math.floor(i/(COLS+1))/ROWS*h+p.y*h;
  const dx=vx-px,dy=vy-py,d=Math.hypot(dx,dy);
  if(d<.01||d>=radius)return;
  const speed=26*(1-d/radius)**1.5,amount=speed*seconds;
  let nx=p.x*w+dx/d*amount,ny=p.y*h+dy/d*amount;
  const length=Math.hypot(nx,ny),limit=Math.min(MAX_SHIFT,Math.min(w,h)*.18);
  if(length>limit){nx*=limit/length;ny*=limit/length;}
  if(Math.hypot(nx-p.x*w,ny-p.y*h)<.001)return;
  p.x=nx/w;p.y=ny/h;changed=true;
 });
 if(changed)art.ink.dirty=true;return changed;
}
function triangle(ctx,img,s,d){
 const [a,b,c]=s,[p,q,r]=d,det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
 if(Math.abs(det)<1e-8)return;
 const A=((q.x-p.x)*(c.y-a.y)-(r.x-p.x)*(b.y-a.y))/det;
 const C=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(c.x-a.x))/det;
 const B=((q.y-p.y)*(c.y-a.y)-(r.y-p.y)*(b.y-a.y))/det;
 const D=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(c.x-a.x))/det;
 ctx.save();ctx.beginPath();
 // A subpixel overlap closes raster seams between adjacent triangles.
 const mx=(p.x+q.x+r.x)/3,my=(p.y+q.y+r.y)/3;
 for(const [i,v]of d.entries()){const length=Math.hypot(v.x-mx,v.y-my)||1;const x=v.x+(v.x-mx)/length*.35,y=v.y+(v.y-my)/length*.35;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
 ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,p.x-A*a.x-C*a.y,p.y-B*a.x-D*a.y);const sx=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))-1),sy=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))-1);
 const ex=Math.min(img.width,Math.ceil(Math.max(a.x,b.x,c.x))+1),ey=Math.min(img.height,Math.ceil(Math.max(a.y,b.y,c.y))+1);
 ctx.drawImage(img,sx,sy,ex-sx,ey-sy,sx,sy,ex-sx,ey-sy);ctx.restore();
}
export function drawArtwork(ctx,art,dpr=1){
 const w=art.width*art.scale,h=art.height*art.scale,ink=art.ink;
 if(!ink){ctx.drawImage(art.img,art.screenX,art.screenY,w,h);return;}
 const ratio=Math.min(dpr,Math.sqrt(8000000/((w+120)*(h+120))));
 const key=`${w}:${h}:${ratio}:${art.renderVersion}`;
 if(ink.dirty||ink.key!==key){
  ink.canvas??=document.createElement('canvas');
  const cw=Math.ceil((w+120)*ratio),ch=Math.ceil((h+120)*ratio);
  if(ink.canvas.width!==cw||ink.canvas.height!==ch){ink.canvas.width=cw;ink.canvas.height=ch;}
  // Decode/rasterize a complex SVG once, instead of rerendering all its paths
  // once per triangle (864 times) on every drag frame.
  if(ink.sourceImage!==art.img||ink.sourceKey!==key){
   ink.source??=document.createElement('canvas');ink.source.width=Math.max(1,Math.ceil(w*ratio));ink.source.height=Math.max(1,Math.ceil(h*ratio));
   ink.source.getContext('2d').drawImage(art.img,0,0,ink.source.width,ink.source.height);
   ink.sourceImage=art.img;ink.sourceKey=key;
  }
  const out=ink.canvas.getContext('2d');out.setTransform(1,0,0,1,0,0);out.clearRect(0,0,cw,ch);out.setTransform(ratio,0,0,ratio,60*ratio,60*ratio);
  const src=[],dst=[];
  ink.points.forEach((p,i)=>{const u=(i%(COLS+1))/COLS,v=Math.floor(i/(COLS+1))/ROWS;src.push({x:u*ink.source.width,y:v*ink.source.height});dst.push({x:(u+p.x)*w,y:(v+p.y)*h});});
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const i=y*(COLS+1)+x;for(const ids of [[i,i+1,i+COLS+2],[i,i+COLS+2,i+COLS+1]])triangle(out,ink.source,ids.map(j=>src[j]),ids.map(j=>dst[j]));}
  ink.dirty=false;ink.key=key;
 }
 ctx.drawImage(ink.canvas,art.screenX-60,art.screenY-60,w+120,h+120);
}
