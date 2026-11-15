export function setupStory(){
 const dialog=document.getElementById('storyDialog'),body=document.getElementById('storyBody');let loaded=false;
 document.getElementById('openStory').addEventListener('click',async()=>{
  dialog.showModal();
  if(loaded)return;
  try{
   const response=await fetch(new URL('../data/story.json',import.meta.url));if(!response.ok)throw Error('story');const story=await response.json();
   document.getElementById('storyTitle').textContent=story.title;document.getElementById('storySubtitle').textContent=story.subtitle;
   body.replaceChildren(...story.paragraphs.map(value=>{const p=document.createElement('p');p.textContent=value;return p;}));loaded=true;
  }catch(error){body.textContent='Could not load. Close and try again.';}
 });
 document.getElementById('closeStory').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
}
