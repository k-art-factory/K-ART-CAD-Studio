(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d'),view=$('viewport');
let trimClickPoint=null,measureCursor=null;
let selectedIds=new Set(), groupCounter=0, backupTimer=null, backupReady=false;
let layers=[{name:'0',visible:true,locked:false},{name:'寸法',visible:true,locked:false}],entities=[],history=[],future=[],selected=null,tool='select',editTarget=null,arcMid=null,start=null,preview=null,drag=null,scale=1,offset={x:0,y:0},initialized=false;
const clone=v=>JSON.parse(JSON.stringify(v)),uid=()=>`e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const screen=p=>({x:offset.x+p.x*scale,y:offset.y-p.y*scale});
const world=p=>({x:(p.x-offset.x)/scale,y:(offset.y-p.y)/scale});
const point=e=>{let r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
const objectSnap=p=>{let best=null,limit=10/scale;for(const e of entities){const l=layers.find(x=>x.name===(e.layer||'0'));if(l&&(!l.visible||l.locked))continue;if(e.type==='line'||e.type==='rect'||e.type==='dimension'){let pts=[e.p1,e.p2];if(e.type==='rect')pts.push({x:e.p1.x,y:e.p2.y},{x:e.p2.x,y:e.p1.y});pts.push({x:(e.p1.x+e.p2.x)/2,y:(e.p1.y+e.p2.y)/2});for(const q of pts){let d=Math.hypot(p.x-q.x,p.y-q.y);if(d<limit){limit=d;best=q}}}else if(e.type==='circle'){let d=Math.hypot(p.x-e.center.x,p.y-e.center.y);if(d<limit){limit=d;best=e.center}}}return best};
const snap=p=>{if($('objectSnap').checked){const q=objectSnap(p);if(q)return {...q}}const n=Number($('gridStep').value);return $('snap').checked&&n>0?{x:Math.round(p.x/n)*n,y:Math.round(p.y/n)*n}:p};
const getWorld=e=>snap(world(point(e)));
function snapshot(){scheduleBackup();history.push(clone(entities));if(history.length>100)history.shift();future=[]}
function commit(entity){snapshot();entities.push({...entity,id:uid(),layer:$('layer').value});selected=null;selectedIds.clear();update();draw()}
function resize(){let r=view.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);if(!initialized){offset={x:r.width/2,y:r.height/2};initialized=true}draw()}
function shape(e,color='#e5eef9',width=1.5){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();if(e.type==='line'){let a=screen(e.p1),b=screen(e.p2);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)}else if(e.type==='rect'){let a=screen(e.p1),b=screen(e.p2);ctx.rect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(b.x-a.x),Math.abs(b.y-a.y))}else if(e.type==='circle'){let c=screen(e.center);ctx.arc(c.x,c.y,Math.abs(e.radius*scale),0,Math.PI*2)}else if(e.type==='arc'){let c=screen(e.center);ctx.arc(c.x,c.y,e.radius*scale,-e.startAngle,-e.endAngle,!e.ccw)}else if(e.type==='text'){let p=screen(e.position);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-(e.rotation||0)*Math.PI/180);ctx.fillStyle=color;ctx.font=`${Math.max(1,e.height*scale)}px sans-serif`;ctx.textBaseline='alphabetic';for(const [i,line] of e.text.split('\\n').entries())ctx.fillText(line,0,i*e.height*scale*1.3);ctx.restore()}else if(e.type==='dimension'){let a=screen(e.p1),b=screen(e.p2),y=Math.min(a.y,b.y)-24;ctx.moveTo(a.x,a.y);ctx.lineTo(a.x,y-5);ctx.moveTo(b.x,b.y);ctx.lineTo(b.x,y-5);ctx.moveTo(a.x,y);ctx.lineTo(b.x,y);ctx.moveTo(a.x+5,y-3);ctx.lineTo(a.x,y);ctx.lineTo(a.x+5,y+3);ctx.moveTo(b.x-5,y-3);ctx.lineTo(b.x,y);ctx.lineTo(b.x-5,y+3)}ctx.stroke();if(e.type==='dimension'){let a=screen(e.p1),b=screen(e.p2);ctx.fillStyle=color;ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(Math.hypot(e.p2.x-e.p1.x,e.p2.y-e.p1.y).toFixed(2)+' mm',(a.x+b.x)/2,Math.min(a.y,b.y)-31)}}
function draw(){let w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle='#111820';ctx.fillRect(0,0,w,h);let step=Number($('gridStep').value)*scale;if($('grid').checked&&step>=7&&step<500){ctx.strokeStyle='#243241';ctx.lineWidth=.5;ctx.beginPath();for(let x=((offset.x%step)+step)%step;x<w;x+=step){ctx.moveTo(x,0);ctx.lineTo(x,h)}for(let y=((offset.y%step)+step)%step;y<h;y+=step){ctx.moveTo(0,y);ctx.lineTo(w,y)}ctx.stroke()}ctx.strokeStyle='#587085';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(offset.x,0);ctx.lineTo(offset.x,h);ctx.moveTo(0,offset.y);ctx.lineTo(w,offset.y);ctx.stroke();entities.filter(e=>(layers.find(l=>l.name===(e.layer||'0'))?.visible!==false)).forEach(e=>shape(e,selectedIds.has(e.id)?'#ffbd4b':'#e5eef9',selectedIds.has(e.id)?2.5:1.5));if(editTarget)shape(editTarget,'#f7bd52',2.5);if(preview)shape(preview,'#3ab5ff',1.5);if(tool==='measure'&&start){let a=screen(start),b=screen(measureCursor||start);ctx.save();ctx.strokeStyle='#22e5b1';ctx.lineWidth=2;ctx.setLineDash([7,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);ctx.restore()}$('scale').textContent=`表示: ${scale.toFixed(3)} px/mm`}
function distSegment(p,a,b){let dx=b.x-a.x,dy=b.y-a.y,t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1);t=Math.max(0,Math.min(1,t));return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy))}
function hit(p){let tol=7/scale;for(let i=entities.length-1;i>=0;i--){let e=entities[i];let layer=layers.find(l=>l.name===(e.layer||'0'));if(layer&&(!layer.visible||layer.locked))continue;if((e.type==='line'||e.type==='dimension')&&distSegment(p,e.p1,e.p2)<tol)return e;if(e.type==='text'){let lines=e.text.split('\\n'),height=e.height*lines.length*1.3,width=Math.max(...lines.map(t=>t.length),1)*e.height;let dx=p.x-e.position.x,dy=p.y-e.position.y,ang=(e.rotation||0)*Math.PI/180,localX=dx*Math.cos(ang)+dy*Math.sin(ang),localY=-dx*Math.sin(ang)+dy*Math.cos(ang);if(localX>=-tol&&localX<=width+tol&&localY>=-height-tol&&localY<=tol)return e}if(e.type==='arc'){let d=Math.hypot(p.x-e.center.x,p.y-e.center.y);if(Math.abs(d-e.radius)<tol)return e}if(e.type==='circle'&&Math.abs(Math.hypot(p.x-e.center.x,p.y-e.center.y)-e.radius)<tol)return e;if(e.type==='rect'){let a=e.p1,b=e.p2,c={x:a.x,y:b.y},d={x:b.x,y:a.y};if([[a,c],[c,b],[b,d],[d,a]].some(([u,v])=>distSegment(p,u,v)<tol))return e}}return null}
function moved(e,dx,dy){let n=clone(e);if(n.type==='text'){n.position.x+=dx;n.position.y+=dy}else if(n.type==='circle'||n.type==='arc'){n.center.x+=dx;n.center.y+=dy}else{for(let k of ['p1','p2']){n[k].x+=dx;n[k].y+=dy}}return n}
function make(t,a,b){if(t==='dimension')return{type:'dimension',p1:a,p2:b};if(t==='line')return{type:'line',p1:a,p2:b};if(t==='rect')return{type:'rect',p1:a,p2:b};if(t==='circle')return{type:'circle',center:a,radius:Math.hypot(b.x-a.x,b.y-a.y)};return null}
function update(){selectedIds=new Set([...selectedIds].filter(id=>entities.some(e=>e.id===id)));if(selected&&!entities.some(e=>e.id===selected))selected=null;if(selected&&!selectedIds.has(selected))selectedIds.add(selected);let e=entities.find(x=>x.id===selected);$('details').textContent=selectedIds.size>1?`${selectedIds.size}個選択\n`+[...selectedIds].join(', '):e?JSON.stringify(e,null,2):'未選択';$('count').textContent=`図形数: ${entities.length} / 選択: ${selectedIds.size}`;renderEntityProperties();if(backupReady)scheduleBackup()}
function setTool(t){tool=t;measureCursor=null;if(t==='measure')$('measurement').textContent='開始点をクリックしてください（2点間の直線距離）';editTarget=null;trimClickPoint=null;arcMid=null;start=null;preview=null;drag=null;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));$('aLabel').firstChild.textContent=t==='rect'?'幅':t==='circle'?'半径':'終点 X';$('bLabel').firstChild.textContent=t==='rect'?'高さ':t==='circle'?'（円では未使用）':'終点 Y';$('status').textContent=`ツール: ${t}`;draw()}
// v0.3: line editing. Intersections are calculated in model-space millimetres.
const cross=(a,b)=>a.x*b.y-a.y*b.x;
function intersection(a,b,c,d){const r={x:b.x-a.x,y:b.y-a.y},v={x:d.x-c.x,y:d.y-c.y},den=cross(r,v);if(Math.abs(den)<1e-10)return null;const w={x:c.x-a.x,y:c.y-a.y},t=cross(w,v)/den,u=cross(w,r)/den;return {x:a.x+t*r.x,y:a.y+t*r.y,t,u}}
function editableLine(p){const e=hit(p);return e&&e.type==='line'?e:null}
function arcFrom3(a,b,c){
 const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));if(Math.abs(d)<1e-9)return null;
 const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;
 const center={x:(aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d,y:(aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d};
 const ang=p=>Math.atan2(p.y-center.y,p.x-center.x),tau=2*Math.PI,positive=v=>(v%tau+tau)%tau;
 const startAngle=ang(a),midAngle=ang(b),endAngle=ang(c),ccw=positive(midAngle-startAngle)<positive(endAngle-startAngle);
 return {type:'arc',center,radius:Math.hypot(a.x-center.x,a.y-center.y),startAngle,endAngle,ccw};
}
function editClick(p){
 if(tool==='chamfer'){
  if(!editTarget){editTarget=editableLine(p);draw();$('status').textContent=editTarget?'2本目の直線をクリック':'直線を選択してください';return}
  const a=editTarget,b=editableLine(p);editTarget=null;
  if(!b||a.id===b.id){$('status').textContent='別の直線を選択してください';draw();return}
  const x=intersection(a.p1,a.p2,b.p1,b.p2),distance=Number($('chamferDistance').value);
  if(!x||!Number.isFinite(distance)||distance<=0){$('status').textContent='交点または距離が不正です';draw();return}
  const corner={x:x.x,y:x.y};
  function cut(e){let d1=Math.hypot(e.p1.x-corner.x,e.p1.y-corner.y),d2=Math.hypot(e.p2.x-corner.x,e.p2.y-corner.y);let end=d1>=d2?'p1':'p2',other=end==='p1'?'p2':'p1';let far=e[end],len=Math.hypot(far.x-corner.x,far.y-corner.y);if(len<=distance+1e-9)return null;let near={x:corner.x+(far.x-corner.x)*distance/len,y:corner.y+(far.y-corner.y)*distance/len};let n=clone(e);n[other]=near;return {n,near}}
  // Only accept segments with a shared endpoint at the intersection.
  const tol=1e-6;const hasCorner=e=>Math.min(Math.hypot(e.p1.x-corner.x,e.p1.y-corner.y),Math.hypot(e.p2.x-corner.x,e.p2.y-corner.y))<tol;
  if(!hasCorner(a)||!hasCorner(b)){$('status').textContent='面取りは共通端点を持つ直線2本に対応';draw();return}
  const ca=cut(a),cb=cut(b);if(!ca||!cb){$('status').textContent='面取り距離が線分より長いです';draw();return}
  snapshot();entities[entities.findIndex(e=>e.id===a.id)]=ca.n;entities[entities.findIndex(e=>e.id===b.id)]=cb.n;
  entities.push({id:uid(),type:'line',layer:$('layer').value,p1:ca.near,p2:cb.near});selected=null;selectedIds.clear();update();draw();$('status').textContent='面取りしました';return;
 }

 if(tool==='offset'){
  if(!editTarget){editTarget=editableLine(p);draw();$('status').textContent=editTarget?'複製する側をクリック':'直線をクリックしてください';return}
  const a=editTarget.p1,b=editTarget.p2,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),distance=Number($('offsetDistance').value);
  if(len<1e-9||!Number.isFinite(distance)||distance<=0){$('status').textContent='距離は正の数を入力してください';editTarget=null;return}
  const side=cross({x:dx,y:dy},{x:p.x-a.x,y:p.y-a.y})>=0?1:-1;
  const sx=-dy/len*distance*side,sy=dx/len*distance*side;
  commit({type:'line',p1:{x:a.x+sx,y:a.y+sy},p2:{x:b.x+sx,y:b.y+sy}});
  editTarget=null;$('status').textContent='平行線を作成しました';return
 }
 if(!editTarget){editTarget=editableLine(p);trimClickPoint=editTarget?{...p}:null;draw();$('status').textContent=editTarget?'境界線をクリックしてください':'編集する直線をクリックしてください';return}
 const boundary=editableLine(p),target=editTarget;editTarget=null;
 if(!boundary||boundary.id===target.id){$('status').textContent='別の直線を境界として選択してください';return}
 const x=intersection(target.p1,target.p2,boundary.p1,boundary.p2);
 if(!x||x.u<0||x.u>1){$('status').textContent='境界線と交差しません';return}
 const idx=entities.findIndex(e=>e.id===target.id);if(idx<0)return;
 let n=clone(target);
 if(tool==='extend'){
  if(x.t>=0&&x.t<=1){$('status').textContent='すでに交差しています';return}
  if(x.t<0)n.p1={x:x.x,y:x.y};else n.p2={x:x.x,y:x.y}
 }else{
  if(x.t<=0||x.t>=1){$('status').textContent='線分の内側に交点がありません';return}
  // Keep the segment on the opposite side of the clicked target endpoint.
  const click=trimClickPoint||p;const d1=Math.hypot(click.x-target.p1.x,click.y-target.p1.y),d2=Math.hypot(click.x-target.p2.x,click.y-target.p2.y);
  if(d1<=d2)n.p1={x:x.x,y:x.y};else n.p2={x:x.x,y:x.y};
 }
 snapshot();entities[idx]=n;selected=n.id;update();draw();$('status').textContent=tool==='trim'?'トリムしました':'延長しました'
}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1)return;canvas.setPointerCapture(e.pointerId);let p=getWorld(e);if(e.button===1||tool==='pan'){drag={mode:'pan',at:point(e),old:{...offset}};return}if(['trim','extend','offset','chamfer'].includes(tool)){editClick(world(point(e)));return}if(tool==='measure'){
 if(!start){start={...p};measureCursor={...p};$('measurement').textContent=`開始点 X: ${p.x.toFixed(3)} / Y: ${p.y.toFixed(3)} mm。終了点をクリックしてください`; $('status').textContent='距離測定：終了点をクリック';draw()}
 else{const dx=p.x-start.x,dy=p.y-start.y,distance=Math.hypot(dx,dy);$('measurement').textContent=`距離: ${distance.toFixed(3)} mm / ΔX: ${dx.toFixed(3)} mm / ΔY: ${dy.toFixed(3)} mm`; $('status').textContent=`測定完了：${distance.toFixed(3)} mm（続けて開始点をクリックできます）`;start=null;measureCursor=null;draw()}
 return
 }if(tool==='text'){let value=$('textValue').value,height=Number($('textHeight').value),rotation=Number($('textRotation').value);if(!value.trim()||!Number.isFinite(height)||height<=0||!Number.isFinite(rotation)){alert('文字・高さ・角度を確認してください');return}commit({type:'text',text:value,height,rotation,position:p});$('status').textContent='文字を配置しました';return}if(tool==='arc'){if(!start){start=p;$('status').textContent='通過点を指定'}else if(!arcMid){arcMid=p;$('status').textContent='終点を指定'}else{let arc=arcFrom3(start,arcMid,p);if(arc)commit(arc);else $('status').textContent='3点が一直線です';start=null;arcMid=null;preview=null;draw()}return}if(tool==='select'){let found=hit(world(point(e)));if(e.shiftKey){if(found){const group=found.groupId?entities.filter(x=>x.groupId===found.groupId):[found];for(const item of group){if(selectedIds.has(item.id))selectedIds.delete(item.id);else selectedIds.add(item.id)}}selected=selectedIds.size?[...selectedIds][0]:null}else{selectedIds.clear();if(found){const group=found.groupId?entities.filter(x=>x.groupId===found.groupId):[found];group.forEach(x=>selectedIds.add(x.id))}selected=found?.id||null}if(found?.type==='text'){$('textValue').value=found.text;$('textHeight').value=found.height;$('textRotation').value=found.rotation||0}if(found&&!e.shiftKey){drag={mode:'move',at:world(point(e)),originals:entities.filter(x=>selectedIds.has(x.id)).map(clone),snapshotted:false}}update();draw();return}if(!start){start=p;$('status').textContent='終点を指定してください'}else{let entity=make(tool,start,p);if(tool==='measure'){$('measurement').textContent=`距離: ${Math.hypot(p.x-start.x,p.y-start.y).toFixed(3)} mm / ΔX: ${(p.x-start.x).toFixed(3)} / ΔY: ${(p.y-start.y).toFixed(3)}`}else if(entity)commit(entity);start=null;preview=null;$('status').textContent='作図完了'}});
// RC6: double-click an entity to select it and reveal its editable properties.
canvas.addEventListener('dblclick',e=>{
 if(e.button!==0)return;
 const found=hit(world(point(e)));if(!found)return;
 e.preventDefault();setTool('select');
 selectedIds=new Set([found.id]);selected=found.id;propertiesEntityId=null;
 update();draw();
 $('rightPanel').classList.remove('collapsed');resize();
 const area=$('entityProperties');area.scrollIntoView({behavior:'smooth',block:'center'});
 const field=area.querySelector('input,textarea');if(field)field.focus({preventScroll:true});
 $('status').textContent='図形のプロパティを表示しました。変更後は「変更を適用」を押してください';
});
canvas.addEventListener('pointermove',e=>{let raw=world(point(e)),p=snap(raw);$('coords').textContent=`X: ${raw.x.toFixed(2)} / Y: ${raw.y.toFixed(2)}`;if(drag?.mode==='pan'){let q=point(e);offset={x:drag.old.x+q.x-drag.at.x,y:drag.old.y+q.y-drag.at.y};draw();return}if(drag?.mode==='move'){let dx=raw.x-drag.at.x,dy=raw.y-drag.at.y;if(!drag.snapshotted&&Math.hypot(dx,dy)>1e-7){snapshot();drag.snapshotted=true}for(const original of drag.originals){let idx=entities.findIndex(x=>x.id===original.id);if(idx>=0)entities[idx]=moved(original,dx,dy)}update();draw();return}if(tool==='measure'&&start){measureCursor=p;const dx=p.x-start.x,dy=p.y-start.y;$('measurement').textContent=`測定中: ${Math.hypot(dx,dy).toFixed(3)} mm / ΔX: ${dx.toFixed(3)} mm / ΔY: ${dy.toFixed(3)} mm`;draw();return}if(start){preview=tool==='arc'&&arcMid?arcFrom3(start,arcMid,p):make(tool,start,p);draw()}});
canvas.addEventListener('pointerup',()=>{if(drag?.snapshotted)scheduleBackup();drag=null});canvas.addEventListener('pointercancel',()=>{drag=null});
canvas.addEventListener('wheel',e=>{e.preventDefault();let p=point(e),anchor=world(p),factor=e.deltaY<0?1.15:1/1.15;scale=Math.min(1000,Math.max(.01,scale*factor));offset={x:p.x-anchor.x*scale,y:p.y+anchor.y*scale};draw()},{passive:false});
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('numeric').onclick=()=>{if(!['line','rect','circle','dimension'].includes(tool)){alert('直線・長方形・円・寸法線のいずれかを選択してください');return}let [x,y,a,b]=['x','y','a','b'].map(id=>Number($(id).value));if(![x,y,a,b].every(Number.isFinite)){alert('数値を確認してください');return}let p={x,y},q=tool==='rect'?{x:x+a,y:y+b}:tool==='circle'?{x:x+a,y}: {x:a,y:b};if(tool==='circle'&&a<=0){alert('半径は正の数にしてください');return}commit(make(tool,p,q))};
function deleteSelected(){if(!selectedIds.size)return;snapshot();entities=entities.filter(e=>!selectedIds.has(e.id));selected=null;selectedIds.clear();update();draw()}
$('delete').onclick=deleteSelected;
function undo(){if(!history.length)return;future.push(clone(entities));entities=history.pop();selected=null;selectedIds.clear();update();draw()}
function redo(){if(!future.length)return;history.push(clone(entities));entities=future.pop();selected=null;selectedIds.clear();update();draw()}
$('undo').onclick=undo;$('redo').onclick=redo;
$('new').onclick=()=>{if(entities.length&&!confirm('現在の図面を破棄して新規作成しますか？'))return;snapshot();entities=[];selected=null;selectedIds.clear();update();draw()};
$('save').onclick=()=>{let payload={format:'KART-CAD',version:'1.0',units:'mm',layers,entities};let blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='drawing.kartcad.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
// Save As retains the same JSON schema but requests a different filename.
$('saveAs').onclick=()=>{let filename=prompt('保存するファイル名を入力してください','drawing-copy.kartcad.json');if(filename===null)return;filename=filename.trim();if(!filename)return;filename=filename.replace(/[\\/:*?"<>|]/g,'_');if(!filename.toLowerCase().endsWith('.json'))filename+='.json';const payload={format:'KART-CAD',version:'1.0',units:'mm',layers,entities};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let data=JSON.parse(await f.text());if(data.format!=='KART-CAD'||!Array.isArray(data.entities))throw Error('K-ART CAD形式ではありません');let valid=data.entities.every(x=>['line','rect','circle','dimension','arc','text'].includes(x.type)&&typeof x.id==='string');if(!valid)throw Error('未対応の図形が含まれています');snapshot();entities=data.entities;selectedIds.clear();propertiesEntityId=null;layers=Array.isArray(data.layers)&&data.layers.length?data.layers:layers;refreshLayers();selected=null;selectedIds.clear();update();draw();$('status').textContent='読み込み完了'}catch(err){alert('読み込み失敗: '+err.message)}e.target.value=''};
['grid','snap','objectSnap','gridStep'].forEach(id=>$(id).addEventListener('change',draw));
// RC6 keyboard shortcuts. Browser-level shortcuts are intercepted only when applicable.
let entityClipboard=[];
function copySelectedToClipboard(){
 const items=activeSelection();if(!items.length){$('status').textContent='コピーする図形を選択してください';return}
 entityClipboard=clone(items);$('status').textContent=`${items.length}個の図形をコピーしました（Ctrl+Vで貼り付け）`;
}
function pasteClipboard(){
 if(!entityClipboard.length){$('status').textContent='貼り付ける図形がありません';return}
 snapshot();const groups=new Map();const items=entityClipboard.map(e=>{
  const n=moved(e,10,10);n.id=uid();
  if(n.groupId){if(!groups.has(n.groupId))groups.set(n.groupId,'g_'+uid());n.groupId=groups.get(n.groupId)}
  return n;
 });entities.push(...items);selectedIds=new Set(items.map(e=>e.id));selected=items[0].id;update();draw();
 $('status').textContent=`${items.length}個の図形を貼り付けました（元の位置からX+10mm、Y+10mm）`;
}
window.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();
 const target=e.target;
 const editing=target?.closest?.('input,textarea,select,[contenteditable="true"]');
 // Escape closes dialogs / active drawing operations even while an input is focused.
 if(e.key==='Escape'){
  measureCursor=null;editTarget=null;trimClickPoint=null;arcMid=null;start=null;preview=null;drag=null;draw();return;
 }
 if(editing||e.altKey)return;
 if(e.key==='F1'){e.preventDefault();$('helpButton').click();return}
 if(e.ctrlKey||e.metaKey){
  const commands={
   g:()=>$(e.shiftKey?'ungroupSelection':'groupSelection').click(),
   z:()=>e.shiftKey?redo():undo(),y:()=>redo(),s:()=>$('save').click(),
   o:()=>$('open').click(),n:()=>$('new').click(),p:()=>$('printDrawing').click(),
   a:()=>$('selectAll').click(),c:()=>copySelectedToClipboard(),v:()=>pasteClipboard()
  };
  if(commands[key]){e.preventDefault();commands[key]()}return;
 }
 if(e.shiftKey)return;
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();return}
 if(e.key==='Home'){$('goHome').click();return}
 const keys={v:'select',l:'line',r:'rect',c:'circle',h:'pan',d:'dimension',q:'measure',a:'arc',f:'chamfer',t:'trim',e:'extend',o:'offset',n:'text'};
 if(keys[key]){e.preventDefault();setTool(keys[key])}
});
function refreshLayers(){let old=$('layer').value;$('layer').replaceChildren();for(let l of layers){let opt=document.createElement('option');opt.value=l.name;opt.textContent=l.name+(l.visible?'':' (非表示)')+(l.locked?' 🔒':'');$('layer').append(opt)}if(layers.some(l=>l.name===old))$('layer').value=old;let l=layers.find(l=>l.name===$('layer').value);$('layerInfo').textContent=l?`表示: ${l.visible?'ON':'OFF'} / ロック: ${l.locked?'ON':'OFF'}`:''}
$('layer').addEventListener('change',refreshLayers);
$('addLayer').onclick=()=>{let name=prompt('新しいレイヤー名');if(!name)return;name=name.trim();if(!name||layers.some(l=>l.name===name)){alert('名前が空か、同名のレイヤーがあります');return}layers.push({name,visible:true,locked:false});refreshLayers();$('layer').value=name;refreshLayers()};
$('toggleLayer').onclick=()=>{let l=layers.find(l=>l.name===$('layer').value);if(!l)return;l.visible=!l.visible;selected=null;refreshLayers();update();draw()};
$('lockLayer').onclick=()=>{let l=layers.find(l=>l.name===$('layer').value);if(!l)return;l.locked=!l.locked;selected=null;refreshLayers();update();draw()};
refreshLayers();
$('editText').onclick=()=>{let e=entities.find(x=>x.id===selected);if(!e||e.type!=='text'){alert('文字図形を選択してください');return}let value=$('textValue').value,height=Number($('textHeight').value),rotation=Number($('textRotation').value);if(!value.trim()||!Number.isFinite(height)||height<=0||!Number.isFinite(rotation)){alert('文字・高さ・角度を確認してください');return}snapshot();e.text=value;e.height=height;e.rotation=rotation;update();draw();$('status').textContent='文字を更新しました'};


// RC5: multiple selection, groups, numeric transformations, editable properties, recovery.
function activeSelection(){return entities.filter(e=>selectedIds.has(e.id))}
function safeNumber(id){const n=Number($(id).value);return Number.isFinite(n)?n:null}
function transformSelection(copy){const dx=safeNumber('moveX'),dy=safeNumber('moveY');if(dx===null||dy===null){alert('移動量を確認してください');return}const items=activeSelection();if(!items.length){alert('図形を選択してください');return}snapshot();if(copy){const groupMap=new Map();const copies=items.map(e=>{let n=moved(e,dx,dy);n.id=uid();if(n.groupId){if(!groupMap.has(n.groupId))groupMap.set(n.groupId,'g_'+uid());n.groupId=groupMap.get(n.groupId)}return n});entities.push(...copies);selectedIds=new Set(copies.map(x=>x.id));selected=copies[0].id}else{for(const e of items){const idx=entities.findIndex(x=>x.id===e.id);entities[idx]=moved(e,dx,dy)}}update();draw();$('status').textContent=copy?'数値でコピーしました':'数値で移動しました'}
$('moveExact').onclick=()=>transformSelection(false);$('copyExact').onclick=()=>transformSelection(true);
$('selectAll').onclick=()=>{selectedIds=new Set(entities.filter(e=>{const l=layers.find(x=>x.name===(e.layer||'0'));return !l||l.visible&&!l.locked}).map(e=>e.id));selected=selectedIds.size?[...selectedIds][0]:null;update();draw()};
$('groupSelection').onclick=()=>{const items=activeSelection();if(items.length<2){alert('Shift＋クリックで2個以上選択してください');return}snapshot();const id='g_'+uid();items.forEach(e=>e.groupId=id);update();draw();$('status').textContent=`${items.length}個をグループ化しました`};
$('ungroupSelection').onclick=()=>{const items=activeSelection().filter(e=>e.groupId);if(!items.length){alert('グループ化された図形を選択してください');return}snapshot();items.forEach(e=>delete e.groupId);update();draw();$('status').textContent='グループを解除しました'};
const propFields={line:[['p1.x','始点 X'],['p1.y','始点 Y'],['p2.x','終点 X'],['p2.y','終点 Y'],['length','線の長さ (mm)']],dimension:[['p1.x','始点 X'],['p1.y','始点 Y'],['p2.x','終点 X'],['p2.y','終点 Y']],rect:[['p1.x','始点 X'],['p1.y','始点 Y'],['width','幅 (mm)'],['height','高さ (mm)']],circle:[['center.x','中心 X'],['center.y','中心 Y'],['radius','半径 (mm)']],arc:[['center.x','中心 X'],['center.y','中心 Y'],['radius','半径 (mm)']],text:[['position.x','配置 X'],['position.y','配置 Y'],['height','文字高さ (mm)'],['rotation','角度 (度)']]};
function propValue(e,key){if(key==='length')return Math.hypot(e.p2.x-e.p1.x,e.p2.y-e.p1.y);if(key==='width')return e.p2.x-e.p1.x;if(key==='height'&&e.type==='rect')return e.p2.y-e.p1.y;return key.split('.').reduce((o,k)=>o?.[k],e)}
let propertiesEntityId=null;
function renderEntityProperties(){const area=$('entityProperties');if(!area)return;const items=activeSelection();if(items.length!==1){propertiesEntityId=null;area.textContent=items.length?'複数選択中：個別編集は1個ずつ選択してください':'図形を選択してください';return}const e=items[0];if(propertiesEntityId===e.id&&area.querySelector('input'))return;propertiesEntityId=e.id;area.replaceChildren();for(const [key,label] of propFields[e.type]||[]){const lab=document.createElement('label');lab.textContent=label;const input=document.createElement('input');input.type='number';input.step='any';input.dataset.prop=key;input.value=Number(propValue(e,key)).toFixed(4);lab.append(input);area.append(lab)}if(e.type==='text'){const lab=document.createElement('label');lab.textContent='文字内容';const t=document.createElement('textarea');t.dataset.prop='text';t.value=e.text;lab.append(t);area.append(lab)}}
$('applyProperties').onclick=()=>{const items=activeSelection();if(items.length!==1){alert('編集する図形を1個選択してください');return}const e=items[0],n=clone(e);const values={};for(const el of $('entityProperties').querySelectorAll('[data-prop]')){if(el.dataset.prop==='text'){values.text=el.value;continue}const v=Number(el.value);if(!Number.isFinite(v)){alert('数値を確認してください');return}values[el.dataset.prop]=v}for(const [key,v] of Object.entries(values)){if(['length','width'].includes(key)||(key==='height'&&n.type==='rect'))continue;const parts=key.split('.');if(parts.length===2)n[parts[0]][parts[1]]=v;else n[key]=v}if(n.type==='line'&&'length' in values){if(values.length<=0){alert('長さは正の値にしてください');return}const dx=n.p2.x-n.p1.x,dy=n.p2.y-n.p1.y,len=Math.hypot(dx,dy);if(len<1e-9){alert('長さ0の線は方向を指定できません');return}n.p2={x:n.p1.x+dx/len*values.length,y:n.p1.y+dy/len*values.length}}if(n.type==='rect'){if('width' in values)n.p2.x=n.p1.x+values.width;if('height' in values)n.p2.y=n.p1.y+values.height}if((n.type==='circle'||n.type==='arc')&&n.radius<=0){alert('半径は正の値にしてください');return}if(n.type==='text'&&(n.height<=0||!n.text.trim())){alert('文字と高さを確認してください');return}snapshot();entities[entities.findIndex(x=>x.id===e.id)]=n;propertiesEntityId=null;update();draw();$('status').textContent='プロパティを変更しました'};
const BACKUP_KEY='kartcad.autobackup.v1';let lastBackup='';
function scheduleBackup(){if(!backupTimer){backupTimer=setTimeout(()=>{backupTimer=null;try{const payload=JSON.stringify({format:'KART-CAD',version:'1.0',units:'mm',layers,entities,savedAt:new Date().toISOString()});if(payload!==lastBackup){localStorage.setItem(BACKUP_KEY,payload);lastBackup=payload;$('backupStatus').textContent='自動保存: '+new Date().toLocaleTimeString()}}catch(err){$('backupStatus').textContent='自動保存できません（保存領域を確認）'}},700)}}
function restoreBackup(ask=true){let raw;try{raw=localStorage.getItem(BACKUP_KEY)}catch(err){}if(!raw){if(ask)alert('復元できるバックアップがありません');return false}try{const d=JSON.parse(raw);if(d.format!=='KART-CAD'||!Array.isArray(d.entities)||!Array.isArray(d.layers))throw Error('データ形式が不正です');if(ask&&!confirm('現在の図面をバックアップで置き換えますか？'))return false;snapshot();entities=d.entities;layers=d.layers;selected=null;selectedIds.clear();propertiesEntityId=null;refreshLayers();update();draw();$('backupStatus').textContent='復元しました: '+new Date(d.savedAt).toLocaleString();return true}catch(err){if(ask)alert('復元失敗: '+err.message);return false}}
$('restoreBackup').onclick=()=>restoreBackup(true);
$('clearBackup').onclick=()=>{if(!confirm('自動バックアップを削除しますか？'))return;try{localStorage.removeItem(BACKUP_KEY);lastBackup='';$('backupStatus').textContent='バックアップを削除しました'}catch(err){alert('削除できませんでした')}};
$('helpButton').onclick=()=>window.open('help.html','_blank','noopener');
// Ask once at startup rather than silently replacing the drawing.
try{if(localStorage.getItem(BACKUP_KEY)){const d=JSON.parse(localStorage.getItem(BACKUP_KEY));if(d.entities?.length){$('backupStatus').textContent='前回の作業があります。復元ボタンから開けます。'}}}catch(_e){}

// v0.5: document-space bounding box and scalable vector export.
function boundsOf(e){
 if(e.type==='text'){let w=Math.max(...e.text.split('\\n').map(t=>t.length),1)*e.height,h=e.text.split('\\n').length*e.height*1.3,r=Math.hypot(w,h);return [e.position.x-r,e.position.y-r,e.position.x+r,e.position.y+r]}if(e.type==='circle'||e.type==='arc')return [e.center.x-e.radius,e.center.y-e.radius,e.center.x+e.radius,e.center.y+e.radius];
 if(e.type==='dimension'){let ymax=Math.max(e.p1.y,e.p2.y)+14;return [Math.min(e.p1.x,e.p2.x),Math.min(e.p1.y,e.p2.y),Math.max(e.p1.x,e.p2.x),ymax]}if(e.p1&&e.p2)return [Math.min(e.p1.x,e.p2.x),Math.min(e.p1.y,e.p2.y),Math.max(e.p1.x,e.p2.x),Math.max(e.p1.y,e.p2.y)];
 return null;
}
function drawingBounds(){
 let bs=entities.filter(e=>layers.find(l=>l.name===(e.layer||'0'))?.visible!==false).map(boundsOf).filter(Boolean);
 if(!bs.length)return null;
 return [Math.min(...bs.map(b=>b[0])),Math.min(...bs.map(b=>b[1])),Math.max(...bs.map(b=>b[2])),Math.max(...bs.map(b=>b[3]))];
}
// RC3: named Home view (viewport position and zoom) distinct from Fit Drawing.
const HOME_KEY='kartcad.home.v1',PANEL_KEY='kartcad.panels.v1',LANG_KEY='kartcad.language.v1';
let homeView=null;
try{const h=JSON.parse(localStorage.getItem(HOME_KEY)||'null');if(h&&Number.isFinite(h.scale)&&h.scale>0&&Number.isFinite(h.x)&&Number.isFinite(h.y))homeView=h}catch(_e){}
function viewCenter(){return world({x:canvas.clientWidth/2,y:canvas.clientHeight/2})}
$('setHome').onclick=()=>{const c=viewCenter();homeView={x:c.x,y:c.y,scale};try{localStorage.setItem(HOME_KEY,JSON.stringify(homeView))}catch(_e){}$('status').textContent='現在の画面中心をホーム位置に登録しました'};
$('goHome').onclick=()=>{if(!homeView){if(drawingBounds()){$('fit').click();$('status').textContent='ホーム未登録のため図面全体を表示しました'}else $('status').textContent='ホームが未登録です。ホーム登録を押してください';return}scale=homeView.scale;offset={x:canvas.clientWidth/2-homeView.x*scale,y:canvas.clientHeight/2+homeView.y*scale};draw();$('status').textContent='ホーム位置に戻りました'};
function savePanels(){try{localStorage.setItem(PANEL_KEY,JSON.stringify({left:$('leftPanel').classList.contains('collapsed'),right:$('rightPanel').classList.contains('collapsed')}))}catch(_e){}}
for(const [button,panel] of [['toggleLeft','leftPanel'],['toggleRight','rightPanel']])$(button).onclick=()=>{$(panel).classList.toggle('collapsed');savePanels();resize()};
try{const saved=JSON.parse(localStorage.getItem(PANEL_KEY)||'{}');if(saved.left)$('leftPanel').classList.add('collapsed');if(saved.right)$('rightPanel').classList.add('collapsed')}catch(_e){}
// Translate static labels without altering IDs, values, event handlers, or user text.
const en={
'新規':'New','保存':'Save','開く':'Open','全体表示':'Fit drawing','⌖ ホーム登録':'Set Home','⌂ ホームへ':'Go Home','印刷プレビュー':'Print preview','印刷 / PDF':'Print / PDF','SVG出力':'Export SVG','PNG出力':'Export PNG','DXF出力':'Export DXF','DXF読込':'Import DXF','↶ 元に戻す':'↶ Undo','↷ やり直し':'↷ Redo','単位: mm':'Unit: mm',
'作図ツール':'Drawing tools','図形編集':'Edit geometry','レイヤー':'Layers','印刷レイアウト':'Print layout','数値作図':'Numeric drawing','文字・注釈':'Text / notes','計測結果':'Measurement','選択図形':'Selected entity','図面情報':'Drawing info',
'選択・移動 (V)':'Select / move (V)','直線 (L)':'Line (L)','長方形 (R)':'Rectangle (R)','円 (C)':'Circle (C)','文字・注釈 (N)':'Text / note (N)','寸法線 (D)':'Dimension (D)','距離を測定 (Q)':'Measure distance (Q)','円弧（3点）(A)':'Arc (3 points) (A)','トリム (T)':'Trim (T)','延長 (E)':'Extend (E)','面取り (F)':'Chamfer (F)','オフセット (O)':'Offset (O)','手のひら (H)':'Pan (H)','選択図形を削除':'Delete selected','＋ レイヤー追加':'＋ Add layer','表示 / 非表示':'Show / hide','ロック / 解除':'Lock / unlock','数値で作図':'Draw with numbers','選択した文字を編集':'Edit selected text','閉じる':'Close',
'☰ 左':'☰ Left','右 ☰':'Right ☰','現在のレイヤー':'Current layer','面取り距離 (mm)':'Chamfer distance (mm)','オフセット距離 (mm)':'Offset distance (mm)','グリッド表示':'Show grid','図形スナップ（端点・中点・中心）':'Object snap (end/mid/center)','グリッドスナップ':'Grid snap','間隔 (mm)':'Spacing (mm)','用紙':'Paper size','向き':'Orientation','横':'Landscape','縦':'Portrait','縮尺 1 :':'Scale 1 :','余白 (mm)':'Margin (mm)','図面枠を表示':'Show frame','表題欄を表示':'Show title block','図面名':'Drawing title','図面番号':'Drawing number','作成者':'Author','始点 X':'Start X','始点 Y':'Start Y','終点 X / 幅':'End X / width','終点 Y / 高さ':'End Y / height','内容':'Content','文字高さ (mm)':'Text height (mm)','回転角度 (度)':'Rotation (degrees)','日本語':'日本語','準備完了':'Ready','未選択':'None','部品A':'Part A'};
const translatedNodes=[];
function collectTranslations(){const root=document.querySelector('body');const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walk.nextNode()){const n=walk.currentNode,original=n.nodeValue;if(!original.trim()||!en[original.trim()])continue;translatedNodes.push({node:n,original,english:en[original.trim()]})}}
collectTranslations();
function setLanguage(lang){document.documentElement.lang=lang;for(const t of translatedNodes)t.node.nodeValue=lang==='en'?t.english:t.original;$('language').value=lang;try{localStorage.setItem(LANG_KEY,lang)}catch(_e){}}
$('language').addEventListener('change',e=>setLanguage(e.target.value));
setLanguage(localStorage.getItem(LANG_KEY)==='en'?'en':'ja');
// Menus: click-to-toggle File, hover/focus Print, close on outside click / Escape / selection.
const menus=[...document.querySelectorAll('.header-menu')];
for(const menu of menus){menu.addEventListener('toggle',()=>{if(menu.open)menus.forEach(other=>{if(other!==menu)other.open=false})});menu.querySelectorAll('.menu-items button').forEach(button=>button.addEventListener('click',()=>{menu.open=false}));}
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.header-menu'))menus.forEach(menu=>menu.open=false)});
document.addEventListener('keydown',event=>{if(event.key==='Escape')menus.forEach(menu=>menu.open=false)});
const printMenu=$('printMenu');printMenu.addEventListener('mouseenter',()=>{printMenu.open=true});printMenu.addEventListener('mouseleave',()=>{if(!printMenu.contains(document.activeElement))printMenu.open=false});
$('language').addEventListener('change',()=>{const lang=$('language').value;document.querySelectorAll('[data-ja][data-en]').forEach(el=>el.textContent=el.dataset[lang]);});
document.querySelectorAll('[data-ja][data-en]').forEach(el=>el.textContent=el.dataset[$('language').value]);

$('fit').onclick=()=>{
 let b=drawingBounds();if(!b){$('status').textContent='全体表示する図形がありません';return}
 let w=canvas.clientWidth,h=canvas.clientHeight,dx=Math.max(b[2]-b[0],1),dy=Math.max(b[3]-b[1],1);
 scale=Math.max(.01,Math.min(1000,Math.min(w*.85/dx,h*.85/dy)));
 offset={x:w/2-(b[0]+b[2])/2*scale,y:h/2+(b[1]+b[3])/2*scale};draw()
};
function downloadText(name,content,mime){
 let url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function svgDocument(){
 let b=drawingBounds();if(!b)return null;
 const pad=10,x=b[0]-pad,y=b[1]-pad,w=Math.max(1,b[2]-b[0]+pad*2),h=Math.max(1,b[3]-b[1]+pad*2);
 const num=v=>Number(v).toFixed(4),pt=p=>`${num(p.x)},${num(-p.y)}`,esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 let shapes=[];
 for(let e of entities){
  if(layers.find(l=>l.name===(e.layer||'0'))?.visible===false)continue;
  let common='fill="none" stroke="#111827" stroke-width="0.25"';
  if(e.type==='text'){let lines=e.text.split('\\n'),safe=t=>esc(t);shapes.push(`<text x="${num(e.position.x)}" y="${num(-e.position.y)}" font-size="${num(e.height)}" fill="#111827" transform="rotate(${num(-(e.rotation||0))} ${num(e.position.x)} ${num(-e.position.y)})">${lines.map((line,i)=>`<tspan x="${num(e.position.x)}" dy="${i?num(e.height*1.3):0}">${safe(line)}</tspan>`).join('')}</text>`)}if(e.type==='line')shapes.push(`<line x1="${num(e.p1.x)}" y1="${num(-e.p1.y)}" x2="${num(e.p2.x)}" y2="${num(-e.p2.y)}" ${common}/>`);
  if(e.type==='rect')shapes.push(`<rect x="${num(Math.min(e.p1.x,e.p2.x))}" y="${num(-Math.max(e.p1.y,e.p2.y))}" width="${num(Math.abs(e.p2.x-e.p1.x))}" height="${num(Math.abs(e.p2.y-e.p1.y))}" ${common}/>`);
  if(e.type==='circle')shapes.push(`<circle cx="${num(e.center.x)}" cy="${num(-e.center.y)}" r="${num(e.radius)}" ${common}/>`);
  if(e.type==='arc'){
   let a={x:e.center.x+e.radius*Math.cos(e.startAngle),y:e.center.y+e.radius*Math.sin(e.startAngle)};
   let z={x:e.center.x+e.radius*Math.cos(e.endAngle),y:e.center.y+e.radius*Math.sin(e.endAngle)};
   let delta=e.ccw?((e.endAngle-e.startAngle+Math.PI*2)%(Math.PI*2)):((e.startAngle-e.endAngle+Math.PI*2)%(Math.PI*2));
   let large=delta>Math.PI?1:0,sweep=e.ccw?0:1;
   shapes.push(`<path d="M ${pt(a)} A ${num(e.radius)} ${num(e.radius)} 0 ${large} ${sweep} ${pt(z)}" ${common}/>`)
  }
  if(e.type==='dimension'){
   let a=e.p1,c=e.p2,yy=Math.max(a.y,c.y)+24/scale; // nominal drawing-space offset
   yy=Math.max(a.y,c.y)+10;
   shapes.push(`<path d="M ${pt(a)} L ${num(a.x)},${num(-yy)} M ${pt(c)} L ${num(c.x)},${num(-yy)} M ${num(a.x)},${num(-yy)} L ${num(c.x)},${num(-yy)}" ${common}/>`);
   shapes.push(`<text x="${num((a.x+c.x)/2)}" y="${num(-yy-2)}" font-size="3" text-anchor="middle" fill="#111827">${esc(Math.hypot(c.x-a.x,c.y-a.y).toFixed(2))} mm</text>`)
  }
 }
 return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${num(w)}mm" height="${num(h)}mm" viewBox="${num(x)} ${num(-b[3]-pad)} ${num(w)} ${num(h)}"><rect x="${num(x)}" y="${num(-b[3]-pad)}" width="${num(w)}" height="${num(h)}" fill="white"/>${shapes.join('')}</svg>`
}
$('svgExport').onclick=()=>{let svg=svgDocument();if(!svg){alert('図形がありません');return}downloadText('drawing.svg',svg,'image/svg+xml;charset=utf-8')};
$('pngExport').onclick=()=>{
 let b=drawingBounds();if(!b){alert('図形がありません');return}
 let svg=svgDocument(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),img=new Image();
 img.onload=()=>{let c=document.createElement('canvas');let w=Math.max(1,b[2]-b[0]+20),h=Math.max(1,b[3]-b[1]+20),ratio=Math.min(4,Math.max(.1,2000/Math.max(w,h)));c.width=Math.round(w*ratio);c.height=Math.round(h*ratio);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);c.toBlob(blob=>{if(!blob)return;let u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='drawing.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)},'image/png')};
 img.onerror=()=>{URL.revokeObjectURL(url);alert('PNGの生成に失敗しました')};img.src=url
};

$('dxfExport').onclick=()=>{
 try{
  const skipped=entities.filter(e=>e.type==='dimension').length;
  if(skipped&&!confirm(`${skipped}個の寸法線はDXF出力に未対応です。寸法線を除いて出力しますか？`))return;
  downloadText('drawing.dxf',KartDXF.exportDXF(entities,layers),'application/dxf;charset=utf-8');
  $('status').textContent='DXF (ASCII R12) を出力しました';
 }catch(err){alert('DXF出力エラー: '+err.message)}
};
$('dxfImport').onclick=()=>$('dxfFile').click();
$('dxfFile').onchange=async event=>{
 const f=event.target.files[0];if(!f)return;
 try{
  const text=await f.text(),data=KartDXF.importDXF(text);
  if(!data.entities.length)throw Error('対応する図形が見つかりません (LINE / CIRCLE / ARC)');
  const note=data.unsupported.length?`未対応の要素: ${data.unsupported.join(', ')}。これらは読み込まれません。`:'';
  if(!confirm(`${data.entities.length}図形を読み込み、現在の図面を置き換えます。${note} 続けますか？`))return;
  snapshot();entities=data.entities;selectedIds.clear();propertiesEntityId=null;layers=data.layers;refreshLayers();selected=null;selectedIds.clear();update();draw();$('fit').click();
  $('status').textContent=`DXF読込: ${entities.length}図形。${note}`;
 }catch(err){alert('DXF読込エラー: '+err.message)}finally{event.target.value=''}
};

// v0.8: print-layout SVG. Geometry remains in model-space millimetres.
// Browser "Save as PDF" creates the PDF; no remote service is used.
const paperMM={A4:[210,297],A3:[297,420],A2:[420,594],A1:[594,841],A0:[841,1189]};
function printSettings(){
 let [a,b]=paperMM[$('paperSize').value]||paperMM.A4;
 const portrait=$('paperOrientation').value==='portrait',pw=portrait?Math.min(a,b):Math.max(a,b),ph=portrait?Math.max(a,b):Math.min(a,b);
 const ratio=Number($('printScale').value),margin=Number($('printMargin').value);
 if(!Number.isFinite(ratio)||ratio<=0||!Number.isFinite(margin)||margin<0||margin*2>=Math.min(pw,ph))throw Error('縮尺または余白の値が不正です');
 return {pw,ph,ratio,margin};
}
function printSvg(){
 const b=drawingBounds();if(!b)throw Error('図形がありません');
 const {pw,ph,ratio,margin}=printSettings();
 const svg=svgDocument();if(!svg)throw Error('図面を作成できません');
 // Existing SVG uses mm viewBox and y-up coordinates. Embed as image at physical scale.
 const docW=(b[2]-b[0]+20)/ratio,docH=(b[3]-b[1]+20)/ratio;
 if(docW>pw-2*margin+1e-8||docH>ph-2*margin+1e-8)throw Error(`図面 ${docW.toFixed(1)}×${docH.toFixed(1)}mm が印刷可能範囲 ${ (pw-2*margin).toFixed(1)}×${(ph-2*margin).toFixed(1)}mm を超えています。縮尺を小さくするか用紙を変更してください`);
 const x=(pw-docW)/2,y=(ph-docH)/2;
 const escapeXml=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 let decorations='';
 if($('printFrame').checked){
   let fx=margin,fy=margin,fw=pw-2*margin,fh=ph-2*margin;
   decorations+=`<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="none" stroke="#111" stroke-width=".35"/>`;
 }
 if($('printTitleBlock').checked){
   let bw=Math.min(95,pw-2*margin),bh=27,tx=pw-margin-bw,ty=ph-margin-bh;
   decorations+=`<g fill="none" stroke="#111" stroke-width=".25"><rect x="${tx}" y="${ty}" width="${bw}" height="${bh}" fill="white"/><path d="M ${tx} ${ty+9} H ${tx+bw} M ${tx} ${ty+18} H ${tx+bw} M ${tx+bw*.62} ${ty+9} V ${ty+27}"/></g>`;
   const label=(text,x,y,size=3)=>`<text x="${x}" y="${y}" font-size="${size}" font-family="sans-serif" fill="#111">${escapeXml(text)}</text>`;
   decorations+=label($('drawingTitle').value,tx+2,ty+6,4)+label('図面番号: '+$('drawingNumber').value,tx+2,ty+15)+label('作成者: '+$('drawingAuthor').value,tx+2,ty+24)+label('縮尺 1:'+ratio,tx+bw*.62+2,ty+15)+label(`${pw}×${ph}mm`,tx+bw*.62+2,ty+24);
 }
 const nested=svg.replace(/^<\\?xml[^>]*>\\s*/, '').replace(/<svg\\b([^>]*)>/, `<svg x="${x}" y="${y}" width="${docW}" height="${docH}" preserveAspectRatio="xMidYMid meet"$1>`);
 return {pw,ph,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}mm" height="${ph}mm" viewBox="0 0 ${pw} ${ph}"><rect width="${pw}" height="${ph}" fill="white"/>${nested}${decorations}</svg>`};
}
$('printPreview').onclick=()=>{
 try{
  const {pw,ph,svg}=printSvg();
  $('previewCanvas').innerHTML=svg;
  $('previewStatus').textContent=`${pw} × ${ph} mm / 印刷倍率 100%`;
  $('previewDialog').hidden=false;
 }catch(e){alert('印刷プレビュー: '+e.message)}
};
$('closePreview').onclick=()=>{$('previewDialog').hidden=true;$('previewCanvas').innerHTML=''};
$('printFromPreview').onclick=()=>{$('printDrawing').click()};
$('printDrawing').onclick=()=>{
 try{
  const {pw,ph,svg}=printSvg();
  const frame=document.createElement('iframe');
  frame.setAttribute('title','CAD印刷');frame.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0';
  document.body.appendChild(frame);
  const doc=frame.contentDocument;
  doc.open();doc.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>K-ART CAD Studio 印刷</title><style>@page{size:${pw}mm ${ph}mm;margin:0}html,body{margin:0;padding:0;width:${pw}mm;height:${ph}mm;overflow:hidden}svg{display:block;width:${pw}mm;height:${ph}mm}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body>${svg}</body></html>`);doc.close();
  setTimeout(()=>{try{frame.contentWindow.focus();frame.contentWindow.print()}catch(e){alert('印刷画面を開けませんでした: '+e.message)}},250);
  setTimeout(()=>frame.remove(),60000);
  $('status').textContent='印刷ダイアログで「PDFに保存」も選択できます。倍率100%・余白なしを確認してください';
 }catch(e){alert('印刷レイアウト: '+e.message)}
};
function updatePrintInfo(){
 try{
  let b=drawingBounds(),{pw,ph,ratio,margin}=printSettings();
  $('printInfo').textContent=`${pw}×${ph}mm / 1:${ratio} / 印刷可能 ${pw-2*margin}×${ph-2*margin}mm`+(b?` / 図面サイズ ${((b[2]-b[0]+20)/ratio).toFixed(1)}×${((b[3]-b[1]+20)/ratio).toFixed(1)}mm`:'');
 }catch(e){$('printInfo').textContent=e.message}
}
for(const id of ['paperSize','paperOrientation','printScale','printMargin','printFrame','printTitleBlock','drawingTitle','drawingNumber','drawingAuthor'])$(id).addEventListener('change',updatePrintInfo);
updatePrintInfo();

window.addEventListener('resize',resize);setTool('select');update();resize();backupReady=true;
})();
