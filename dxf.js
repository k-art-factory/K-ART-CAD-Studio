/* K-ART FACTORY — DXF ASCII R12 subset. No external dependencies. */
(function(root){
'use strict';
const pair=(code,value)=>`${code}\n${value}\n`;
const num=n=>{if(!Number.isFinite(Number(n)))throw Error('無効な座標');return String(Number(n))};
function exportDXF(entities,layers){
 let out=pair(0,'SECTION')+pair(2,'HEADER')+pair(9,'$ACADVER')+pair(1,'AC1009')+pair(9,'$INSUNITS')+pair(70,4)+pair(0,'ENDSEC');
 out+=pair(0,'SECTION')+pair(2,'TABLES')+pair(0,'TABLE')+pair(2,'LAYER')+pair(70,layers.length);
 for(const l of layers)out+=pair(0,'LAYER')+pair(2,l.name)+pair(70,l.locked?4:0)+pair(62,l.visible?-7:7)+pair(6,'CONTINUOUS');
 out+=pair(0,'ENDTAB')+pair(0,'ENDSEC')+pair(0,'SECTION')+pair(2,'ENTITIES');
 const base=(kind,layer)=>pair(0,kind)+pair(8,layer||'0');
 const line=(a,b,layer)=>base('LINE',layer)+pair(10,num(a.x))+pair(20,num(a.y))+pair(30,0)+pair(11,num(b.x))+pair(21,num(b.y))+pair(31,0);
 for(const e of entities){
  const l=e.layer||'0';
  if(e.type==='text'){const lines=e.text.split('\\n');for(let i=0;i<lines.length;i++)out+=base('TEXT',l)+pair(10,num(e.position.x))+pair(20,num(e.position.y-i*e.height*1.3))+pair(30,0)+pair(40,num(e.height))+pair(1,lines[i])+pair(50,num(e.rotation||0))}if(e.type==='line')out+=line(e.p1,e.p2,l);
  if(e.type==='rect'){
   let a=e.p1,b=e.p2,c={x:a.x,y:b.y},d={x:b.x,y:a.y};
   out+=line(a,c,l)+line(c,b,l)+line(b,d,l)+line(d,a,l);
  }
  if(e.type==='circle')out+=base('CIRCLE',l)+pair(10,num(e.center.x))+pair(20,num(e.center.y))+pair(30,0)+pair(40,num(e.radius));
  if(e.type==='arc'){
   const deg=a=>(a*180/Math.PI%360+360)%360;
   out+=base('ARC',l)+pair(10,num(e.center.x))+pair(20,num(e.center.y))+pair(30,0)+pair(40,num(e.radius))+pair(50,num(deg(e.ccw?e.startAngle:e.endAngle)))+pair(51,num(deg(e.ccw?e.endAngle:e.startAngle)));
  }
 }
 return out+pair(0,'ENDSEC')+pair(0,'EOF');
}
function importDXF(text){
 const lines=String(text).replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n');
 let pairs=[];for(let i=0;i+1<lines.length;i+=2){let c=Number(lines[i].trim());if(!Number.isInteger(c))throw Error('DXFグループコードが不正です');pairs.push([c,lines[i+1].trim()])}
 let section='',entity=null,items=[],names=new Set(['0']),unsupported=new Set(),inEntities=false;
 const finish=()=>{
  if(!entity)return;
  let t=entity.type,g=entity.g,at=(n,d=0)=>{let v=g[n];return v===undefined?d:Number(v)},ok=(...v)=>v.every(Number.isFinite),layer=g[8]||'0';
  if(['LINE','CIRCLE','ARC','TEXT'].includes(t)){
   let e={type:t.toLowerCase(),id:'dxf_'+items.length+'_'+Math.random().toString(36).slice(2,8),layer};
   if(t==='TEXT'){e.position={x:at(10),y:at(20)};e.height=at(40,5);e.rotation=at(50);e.text=g[1]||'';if(!ok(e.position.x,e.position.y,e.height,e.rotation)||e.height<=0)throw Error('文字データが不正です')}else if(t==='LINE'){e.p1={x:at(10),y:at(20)};e.p2={x:at(11),y:at(21)};if(!ok(e.p1.x,e.p1.y,e.p2.x,e.p2.y))throw Error('座標が不正です')}
   else{e.center={x:at(10),y:at(20)};e.radius=at(40);if(!ok(e.center.x,e.center.y,e.radius)||e.radius<=0)throw Error('半径が不正です');if(t==='ARC'){e.startAngle=at(50)*Math.PI/180;e.endAngle=at(51)*Math.PI/180;e.ccw=true}}
   items.push(e);names.add(layer);
  }else unsupported.add(t);
  entity=null
 };
 for(let i=0;i<pairs.length;i++){
  let [code,value]=pairs[i];
  if(code===0&&value==='SECTION'){finish();section='';inEntities=false;continue}
  if(code===2&&section===''){section=value;inEntities=section==='ENTITIES';continue}
  if(code===0&&value==='ENDSEC'){finish();section='';inEntities=false;continue}
  if(!inEntities)continue;
  if(code===0){finish();if(value==='EOF')break;entity={type:value,g:{}}}
  else if(entity&&entity.g[code]===undefined)entity.g[code]=value;
 }
 finish();
 if(!pairs.some(p=>p[0]===0&&p[1]==='EOF'))throw Error('DXF終端が見つかりません');
 return {entities:items,layers:[...names].map(name=>({name,visible:true,locked:false})),unsupported:[...unsupported]};
}
root.KartDXF={exportDXF,importDXF};
if(typeof module!=='undefined'&&module.exports)module.exports=root.KartDXF;
})(typeof globalThis!=='undefined'?globalThis:this);
