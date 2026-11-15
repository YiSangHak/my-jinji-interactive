// Build display-only SVGs at their final resolution. Original source files remain untouched.
export async function displayImage(source,width,height,strokeWidth,density=1){
 const doc=new DOMParser().parseFromString(source,'image/svg+xml'),root=doc.documentElement;
 root.setAttribute('width',String(Math.max(1,Math.round(width*density))));
 root.setAttribute('height',String(Math.max(1,Math.round(height*density))));
 for(const node of root.querySelectorAll('[stroke]')){
  if(node.getAttribute('stroke')==='none')continue;
  node.setAttribute('stroke-width',String(strokeWidth*density));
  node.setAttribute('vector-effect','non-scaling-stroke');
 }
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml'}));
 try{const img=new Image();img.src=url;await img.decode();return img;}finally{URL.revokeObjectURL(url);}
}
