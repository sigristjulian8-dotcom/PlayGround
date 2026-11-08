(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 3200, H = 600, groundBase = 476;
  const names = ['Mara Voss','Eli Mercer','June Park','Otto Kade','Nia Sol','Rook Bell','Iris Vale','Finn Ash','Tess Rowan','Calder Pike','Luz Ortega','Bram Holt','Sage Kim','Kit Wilder','Dara Quinn','Ash Moreno','Noa Finch','Remy Stone','Vera Knox','Jude North'];
  const palettes = [ ['#d3a174','#263e35','#d47b50'],['#ba825d','#354453','#d6ae6e'],['#e3b58a','#5b3841','#c4d27c'],['#d39b72','#53503a','#d17b55'],['#9b674d','#374c56','#d8bc70'],['#d7aa82','#463c58','#c67a5f'],['#c58a63','#4b5a40','#e1b06b'],['#edc39a','#4a3940','#8fb578'],['#ae7657','#344e43','#d4a65e'],['#dcb28d','#524535','#d87c62'],['#9f6b50','#354756','#b4ca77'],['#c9906b','#51444d','#d5aa68'],['#e7bd94','#40513d','#ce7655'],['#b97d5a','#475363','#d4c16f'],['#d5a47f','#543b36','#91b177'],['#a66d51','#394c3e','#d89959'],['#e0b48d','#474254','#d57b61'],['#c38b65','#4c4a36','#c4d37b'],['#d9aa84','#384b50','#d17f58'],['#b27857','#504153','#d5b66b'] ];
  const surnames = names.map(n=>n.split(' ')[1]);
  let agents=[], resources=[], structures=[], arrows=[], particles=[], events=[], simTime=0, paused=false, speed=1, selected=null, sortByScore=true, lastFrame=0, uiTimer=0, ended=false, seed=48391, cameraX=0, canvasW=900, canvasH=500, dpr=1, deaths=0, worldTick=0;
  let rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const terrainY=x=>groundBase+Math.sin(x*.0042)*14+Math.sin(x*.012)*5+Math.sin(x*.0014+1)*16;
  const addEvent=(icon,text,type='')=>{events.unshift({icon,text,time:simTime,type});events=events.slice(0,8)};
  function makeWorld(){
    seed=48391;simTime=0;paused=false;speed=1;selected=null;ended=false;deaths=0;worldTick=0;arrows=[];particles=[];events=[];structures=[];
    agents=names.map((name,i)=>({id:i,name,x:170+i*150+(rand()-.5)*35,y:0,vx:0,hp:100,hunger:100,stamina:100,wood:0,stone:0,food:0,kills:0,score:0,alive:true,weapon: i%7===0?'bow':(i%4===0?'spear':'hands'),armor:0,team:i,brain:'scavenge',target:null,action:0,attack:rand()*.7,walk:rand()*8,look:rand()<.5?-1:1,flash:0,craft:0,builds:0,anim:rand()*7,skill:.75+rand()*.5}));
    resources=[];
    for(let i=0;i<60;i++){let x=65+rand()*(W-130),type=rand()<.43?'tree':rand()<.72?'rock':rand()<.52?'berry':'crate';resources.push({x,y:terrainY(x),type,amount:type==='tree'?3+Math.floor(rand()*3):type==='rock'?2+Math.floor(rand()*3):type==='berry'?2+Math.floor(rand()*3):1,phase:rand()*9})}
    for(let i=0;i<agents.length;i++)agents[i].y=terrainY(agents[i].x);
    addEvent('✦','The trial begins. Twenty enter the frontier.');addEvent('⌁','Scattered supplies detected across the valley.');
    updateControls();renderUI(true);
  }
  function resize(){const r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);canvasW=r.width;canvasH=r.height;canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
  const alive=()=>agents.filter(a=>a.alive);
  function nearest(a,filter){let best=null,dist=Infinity;for(const x of filter){let d=Math.abs(x.x-a.x);if(d<dist){dist=d;best=x}}return best}
  function chooseAction(a){
    const foes=alive().filter(b=>b!==a), close=foes.filter(b=>Math.abs(b.x-a.x)<145);
    if(close.length && (a.weapon!=='hands'||a.hp>48||close.length>1)){a.target=nearest(a,close);a.brain='fight';return}
    if(a.hp<43&&a.food>0){a.food--;a.hp=Math.min(100,a.hp+35);a.hunger=Math.min(100,a.hunger+27);a.brain='rest';a.action=1.1;addEvent('＋',`<b>${a.name}</b> patches up with a ration.`);return}
    if(a.hunger<43){let berries=resources.filter(r=>r.amount>0&&(r.type==='berry'||r.type==='crate'));if(berries.length){a.target=nearest(a,berries);a.brain='scavenge';return}if(a.food>0){a.food--;a.hunger=Math.min(100,a.hunger+38);a.action=.8;return}}
    if(a.wood>=4&&rand()<.5){a.brain='build';a.action=.8;return}
    if(a.wood>=3&&a.weapon==='hands'){a.brain='craft';a.action=1.2;return}
    let desired=a.weapon==='hands'?'tree':(a.wood<4?'tree':a.stone<2?'rock':(rand()<.55?'berry':'tree'));
    let options=resources.filter(r=>r.amount>0&&(r.type===desired||((desired==='tree'||desired==='rock')&&r.type==='crate')));
    if(!options.length)options=resources.filter(r=>r.amount>0);
    if(options.length){a.target=nearest(a,options);a.brain='scavenge';return}
    a.target=nearest(a,foes);a.brain='fight';
  }
  function move(a,dx,dt){let target=clamp(dx,0,W);let diff=target-a.x;a.look=diff<0?-1:1;let speedNow=61*(a.stamina<15?.7:1);a.vx+=(Math.sign(diff)*Math.min(speedNow,Math.abs(diff)*3)-a.vx)*Math.min(1,dt*4);a.x+=a.vx*dt;a.x=clamp(a.x,24,W-24);a.y=terrainY(a.x);a.walk+=dt*(Math.abs(a.vx)*.11+.5);a.stamina=Math.max(0,a.stamina-dt*(Math.abs(a.vx)>.5?1.5:-4));if(Math.abs(diff)<8){a.vx*=.5;return true}return false}
  function gather(a,r){if(!r||r.amount<=0){a.target=null;return}r.amount--;let item=r.type==='tree'?'wood':r.type==='rock'?'stone':r.type==='berry'?'food':(rand()<.58?'wood':'food');a[item]+=item==='wood'&&r.type==='crate'?2:1;a.score+=1;a.action=1.1;a.flash=.16;
    if(r.type==='tree'||r.type==='rock'){particles.push({x:r.x,y:r.y-18,vx:(rand()-.5)*25,vy:-30,life:.45,color:r.type==='tree'?'#d8c47e':'#c6c8bd',txt:r.type==='tree'?'+ WOOD':'+ STONE'})}
    if(item==='food'&&a.hunger<55){a.food=Math.max(0,a.food-1);a.hunger=Math.min(100,a.hunger+25)}
    if(rand()<.14)addEvent(r.type==='berry'?'✿':'⌁',`<b>${a.name}</b> found ${item==='wood'?'salvage':item}.`);
    if(r.amount===0){resources=resources.filter(q=>q!==r);if(rand()<.28){resources.push({x:clamp(r.x+(rand()-.5)*120,45,W-45),y:terrainY(r.x),type:'berry',amount:2,phase:rand()*9})}}
  }
  function craft(a){if(a.wood>=3&&a.weapon==='hands'){a.wood-=3;a.weapon=rand()<.37?'bow':'spear';a.score+=3;a.craft++;a.action=1.6;addEvent('⚒',`<b>${a.name}</b> fashioned a ${a.weapon}.`)}else if(a.stone>=2&&a.wood>=1){a.stone-=2;a.wood--;a.armor=Math.min(2,a.armor+1);a.action=1.5;addEvent('⬡',`<b>${a.name}</b> reinforced their gear.`)}else a.brain='scavenge'}
  function build(a){if(a.wood<4){a.brain='scavenge';return}a.wood-=4;a.builds++;a.score+=2;structures.push({x:a.x+a.look*22,y:terrainY(a.x),hp:3,owner:a.id,kind:a.builds%2?'wall':'camp',phase:rand()*6});a.action=1.2;addEvent('⌂',`<b>${a.name}</b> built a ${a.builds%2?'barricade':'camp'}.`)}
  function fight(a,target,dt){if(!target||!target.alive){a.target=null;return}let d=Math.abs(target.x-a.x);a.look=target.x<a.x?-1:1;
    const range=a.weapon==='bow'?205:a.weapon==='spear'?39:25;
    if(d>range){move(a,target.x-Math.sign(target.x-a.x)*(range-4),dt);return}
    a.vx*=.72;a.attack-=dt;
    if(a.attack<=0){a.attack=a.weapon==='bow'?1.35:a.weapon==='spear'?.82:1.04;let damage=(a.weapon==='bow'?13:a.weapon==='spear'?11:7)*a.skill*(.8+rand()*.45);if(a.weapon==='bow'){arrows.push({x:a.x+a.look*11,y:a.y-23,target:target,owner:a.id,damage,life:2});particles.push({x:a.x+a.look*14,y:a.y-22,vx:a.look*20,vy:-4,life:.2,color:'#e6d191',txt:''})}else hit(target,damage,a);a.stamina=Math.max(0,a.stamina-3);a.score+=.3}
  }
  function hit(target,damage,attacker){let mitigated=damage*(target.armor?Math.max(.5,1-target.armor*.17):1);target.hp-=mitigated;target.flash=.22;particles.push({x:target.x,y:target.y-27,vx:(rand()-.5)*22,vy:-30,life:.45,color:'#e97c60',txt:`-${Math.round(mitigated)}`});if(target.hp<=0){target.hp=0;target.alive=false;deaths++;attacker.kills++;attacker.score+=14;addEvent('✕',`<b>${attacker.name}</b> eliminated <b>${target.name}</b>.`,'elimination');if(selected===target)selected=attacker;structures=structures.filter(s=>s.owner!==target.id)}}
  function updateAgent(a,dt){if(!a.alive)return;a.anim+=dt;a.flash=Math.max(0,a.flash-dt);a.hunger=Math.max(0,a.hunger-dt*.17);if(a.hunger===0)a.hp-=dt*.55;if(a.hp<=0){a.hp=0;a.alive=false;deaths++;addEvent('✕',`<b>${a.name}</b> succumbed to the wilds.`,'elimination');return}if(a.action>0){a.action-=dt;a.vx*=.7;return}if(!a.target||(!a.target.alive&&a.brain==='fight')||(a.brain==='scavenge'&&a.target.amount<=0)){a.target=null;chooseAction(a)}
    if(a.brain==='fight'){fight(a,a.target,dt);return}
    if(a.brain==='scavenge'){let r=a.target;if(!r){chooseAction(a);return}if(move(a,r.x,dt)){a.vx=0;gather(a,r)}return}
    if(a.brain==='craft'){craft(a);return}if(a.brain==='build'){build(a);return}if(a.brain==='rest'){a.hp=Math.min(100,a.hp+dt*2);return}
  }
  function update(dt){if(paused||ended)return;dt=Math.min(dt,.05)*speed;simTime+=dt;worldTick+=dt;for(const a of agents)updateAgent(a,dt);
    for(let i=arrows.length-1;i>=0;i--){let p=arrows[i],t=p.target;if(!t||!t.alive){arrows.splice(i,1);continue}let dx=t.x-p.x,dy=(t.y-24)-p.y,d=Math.hypot(dx,dy),step=330*dt;if(d<step+8){hit(t,p.damage,agents.find(a=>a.id===p.owner) || nearest(t,alive()));arrows.splice(i,1)}else{p.x+=dx/d*step;p.y+=dy/d*step;p.life-=dt;if(p.life<=0)arrows.splice(i,1)}}
    for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=65*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1)}
    if(simTime>0&&Math.floor(simTime/115)>Math.floor((simTime-dt)/115)){addEvent('☼','Nightfall approaches. Visibility is fading.');document.getElementById('dayNum').textContent=String(1+Math.floor(simTime/115)).padStart(2,'0')}
    if(alive().length<=1){ended=true;let winner=alive()[0];document.getElementById('stateLabel').textContent=winner?'THE TRIAL IS COMPLETE':'NO ONE MADE IT OUT';addEvent(winner?'♛':'✦',winner?`<b>${winner.name}</b> is the last one standing.`:'The frontier claims every survivor.');}
    if(selected&&selected.alive){let targetCam=selected.x-canvasW/(2*(canvasH/H));cameraX+=(targetCam-cameraX)*Math.min(1,dt*1.6)}else{let survivor=alive();if(survivor.length){let center=survivor.reduce((s,a)=>s+a.x,0)/survivor.length;cameraX+=(center-canvasW/(2*(canvasH/H))-cameraX)*Math.min(1,dt*.35)}}cameraX=clamp(cameraX,0,W-canvasW/(canvasH/H));
  }
  const cloud=(x,y,w)=>{ctx.fillRect(x,y,w,3);ctx.fillRect(x+8,y-4,w*.54,4);ctx.fillRect(x+w*.45,y-2,w*.4,2)};
  function drawWorld(){const scale=canvasH/H;ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);ctx.clearRect(0,0,canvasW/scale,H);let view=canvasW/scale;
    let sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#83a9a0');sky.addColorStop(.48,'#bdc9a7');sky.addColorStop(1,'#e1c590');ctx.fillStyle=sky;ctx.fillRect(0,0,view,H);
    // sun and distant ridgelines
    const sunX=610-cameraX*.08;ctx.fillStyle='#ffe2a4';ctx.beginPath();ctx.arc(sunX,93,30,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff0c04d';ctx.beginPath();ctx.arc(sunX,93,47,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#819e8d';ctx.beginPath();ctx.moveTo(0,305);for(let x=0;x<=view+24;x+=24)ctx.lineTo(x,292+Math.sin((x+cameraX*.14)*.007)*39+Math.sin((x+cameraX*.14)*.019)*14);ctx.lineTo(view,H);ctx.lineTo(0,H);ctx.fill();
    ctx.fillStyle='#718a78';ctx.beginPath();ctx.moveTo(0,366);for(let x=0;x<=view+20;x+=20)ctx.lineTo(x,356+Math.sin((x+cameraX*.28)*.009)*23+Math.sin((x+cameraX*.28)*.025)*9);ctx.lineTo(view,H);ctx.lineTo(0,H);ctx.fill();
    ctx.fillStyle='#d9c48e';ctx.beginPath();ctx.moveTo(0,420);for(let x=0;x<=view+12;x+=12)ctx.lineTo(x,410+Math.sin((x+cameraX*.47)*.006)*17);ctx.lineTo(view,H);ctx.lineTo(0,H);ctx.fill();
    // drifting pixel clouds
    ctx.save();ctx.translate(-cameraX*.18,0);ctx.fillStyle='#e7e9d340';for(let i=0;i<7;i++){let x=((i*231+worldTick*3)%(W+260))-80;cloud(x,70+(i%3)*42,53+(i%2)*20)}ctx.restore();
    // ground silhouette, with a lively layered turf
    ctx.fillStyle='#566b49';ctx.beginPath();ctx.moveTo(0,terrainY(cameraX)-5);for(let x=0;x<=view+10;x+=10)ctx.lineTo(x,terrainY(cameraX+x));ctx.lineTo(view,H);ctx.lineTo(0,H);ctx.fill();
    ctx.fillStyle='#82915a';ctx.beginPath();ctx.moveTo(0,terrainY(cameraX));for(let x=0;x<=view+8;x+=8)ctx.lineTo(x,terrainY(cameraX+x));ctx.lineTo(view,terrainY(cameraX+view)+7);ctx.lineTo(0,terrainY(cameraX)+7);ctx.fill();
    // pixelated grass flecks
    for(let i=0;i<150;i++){let x=((i*83+11)%W)-cameraX;if(x< -3||x>view+3)continue;let y=terrainY(x+cameraX)+12+(i*29%115);ctx.fillStyle=i%3?'#34483b66':'#c3a86b5c';ctx.fillRect(x,y,2+(i%3),2)}
    // scattered background pines
    for(let x=Math.floor(cameraX/92)*92-50;x<cameraX+view+80;x+=92){let sx=x-cameraX, y=terrainY(x)-8, h=28+(Math.abs(Math.sin(x*2))*28);ctx.fillStyle='#425b47';ctx.fillRect(sx-2,y-h*.35,4,h*.58);ctx.fillStyle='#38584a';ctx.fillRect(sx-11,y-h*.45,22,6);ctx.fillRect(sx-8,y-h*.64,16,6);ctx.fillRect(sx-5,y-h*.81,10,5);ctx.fillStyle='#607151';ctx.fillRect(sx-7,y-h*.63,4,3)}
    // resources
    for(const r of resources){if(r.x<cameraX-45||r.x>cameraX+view+45)continue;drawResource(r,r.x-cameraX)}
    // structures
    for(const s of structures){let x=s.x-cameraX,y=terrainY(s.x);if(x<-30||x>view+30)continue;ctx.fillStyle='#765d42';if(s.kind==='wall'){ctx.fillRect(x-16,y-34,32,34);ctx.fillStyle='#977551';ctx.fillRect(x-20,y-36,40,5);ctx.fillStyle='#a5a16b';ctx.fillRect(x-12,y-27,5,4);ctx.fillRect(x+5,y-27,5,4)}else{ctx.fillRect(x-11,y-22,22,22);ctx.fillStyle='#b38d58';ctx.fillRect(x-15,y-24,30,5);ctx.fillStyle='#403d32';ctx.fillRect(x-3,y-11,6,11)}ctx.fillStyle='#d3bd81';ctx.fillRect(x-3,y-39,6,2)}
    // arrows before fighters
    for(const p of arrows){let x=p.x-cameraX;ctx.save();ctx.translate(x,p.y);ctx.rotate(Math.atan2((p.target?.y||p.y)-p.y,(p.target?.x||p.x)-p.x));ctx.fillStyle='#49382c';ctx.fillRect(-6,-1,12,2);ctx.fillStyle='#e8cc8d';ctx.fillRect(4,-2,3,4);ctx.restore()}
    // survivors
    let ordered=agents.slice().sort((a,b)=>a.y-b.y);for(const a of ordered){if(a.x<cameraX-50||a.x>cameraX+view+50)continue;drawAgent(a,a.x-cameraX)}
    for(const p of particles){let x=p.x-cameraX;ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.color;if(p.txt){ctx.font='7px monospace';ctx.fillText(p.txt,x-10,p.y)}else ctx.fillRect(x,p.y,3,3);ctx.globalAlpha=1}
    // light dust and day tint
    const night=clamp((simTime%115-76)/32,0,.62);if(night){ctx.fillStyle=`rgba(21,34,52,${night})`;ctx.fillRect(0,0,view,H)}
    // selected highlight
    if(selected&&selected.alive){let x=selected.x-cameraX,y=terrainY(selected.x);ctx.strokeStyle='#d9ec9b';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.ellipse(x,y-17,17,24,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}
  }
  function drawResource(r,x){let y=terrainY(r.x),wig=Math.sin(worldTick*2+r.phase)*.7;
    if(r.type==='tree'){ctx.fillStyle='#72593d';ctx.fillRect(x-3,y-27,7,28);ctx.fillStyle='#365444';ctx.fillRect(x-13,y-44+wig,26,10);ctx.fillRect(x-10,y-54+wig,20,10);ctx.fillRect(x-6,y-63+wig,12,9);ctx.fillStyle='#60734b';ctx.fillRect(x-8,y-51+wig,5,4);ctx.fillStyle='#b7a46d';ctx.fillRect(x-2,y-20,2,12)}else if(r.type==='rock'){ctx.fillStyle='#727a6c';ctx.fillRect(x-10,y-10,20,10);ctx.fillRect(x-7,y-16,14,7);ctx.fillRect(x-4,y-20,8,5);ctx.fillStyle='#a7a78a';ctx.fillRect(x-5,y-14,4,3);ctx.fillStyle='#444f49';ctx.fillRect(x+4,y-8,4,3)}else if(r.type==='berry'){ctx.fillStyle='#597344';ctx.fillRect(x-8,y-13,16,13);ctx.fillRect(x-5,y-18,10,6);ctx.fillStyle='#c56b58';ctx.fillRect(x-6,y-13,4,4);ctx.fillRect(x+2,y-10,4,4);ctx.fillStyle='#e5c276';ctx.fillRect(x-1,y-20,3,3)}else{ctx.fillStyle='#786449';ctx.fillRect(x-10,y-12,20,12);ctx.fillStyle='#b89a65';ctx.fillRect(x-8,y-16,16,5);ctx.fillStyle='#414d3e';ctx.fillRect(x-5,y-8,10,3);ctx.fillStyle='#a6bd6c';ctx.fillRect(x+8,y-16,3,3)}
  }
  function drawAgent(a,x){let y=terrainY(a.x), walk=Math.sin(a.walk)*2.1, bob=Math.abs(Math.sin(a.walk))*.7, colors=palettes[a.id];ctx.save();ctx.translate(Math.round(x),Math.round(y));
    // shadow
    ctx.fillStyle='#263a3380';ctx.fillRect(-9,0,18,3);ctx.fillStyle='#263a3350';ctx.fillRect(-12,1,24,2);
    if(!a.alive){ctx.fillStyle='#554c40';ctx.fillRect(-8,-5,16,5);ctx.fillStyle='#816c50';ctx.fillRect(-4,-7,8,3);ctx.restore();return}
    ctx.translate(0,-bob);
    // backpack and body
    ctx.fillStyle='#594d37';ctx.fillRect(-7,-22,5,11);ctx.fillStyle=colors[1];ctx.fillRect(-5,-23,10,13);ctx.fillRect(-7,-21,3,9);
    // legs
    ctx.fillStyle='#353b34';let stride=Math.abs(a.vx)>4?walk:0;ctx.fillRect(-4+stride,-11,4,9);ctx.fillRect(1-stride,-11,4,9);ctx.fillStyle='#78664b';ctx.fillRect(-5+stride,-3,6,3);ctx.fillRect(1-stride,-3,6,3);
    // neck/head
    ctx.fillStyle=colors[0];ctx.fillRect(-4,-31,8,9);ctx.fillRect(-5,-28,10,3);ctx.fillStyle='#493c32';ctx.fillRect(-5,-34,10,5);ctx.fillRect(-6,-31,3,3);ctx.fillStyle='#292d29';ctx.fillRect(a.look>0?1:-3,-29,2,2);
    // scarf + tunic details
    ctx.fillStyle=colors[2];ctx.fillRect(-5,-23,10,3);ctx.fillRect(a.look>0?3:-5,-22,3,5);ctx.fillStyle='#c1b276';ctx.fillRect(-1,-18,2,4);
    // arms with tool / swing
    let swing=a.brain==='fight'&&a.attack<.22?4:Math.sin(a.anim*4)*1.5;ctx.fillStyle=colors[0];ctx.fillRect(a.look>0?4:-6,-22,3,8);ctx.fillRect(a.look>0?5+swing:-7-swing,-17,3,3);
    if(a.weapon==='spear'||a.weapon==='bow'){ctx.fillStyle='#5e5037';ctx.fillRect(a.look>0?8:-10,-31,2,22);ctx.fillStyle='#d8d1ae';ctx.fillRect(a.look>0?8:-10,-34,2,4);if(a.weapon==='bow'){ctx.strokeStyle='#d7bd85';ctx.lineWidth=1;ctx.beginPath();ctx.arc(a.look>0?7:-7,-20,7,a.look>0?-1.1:2.1,a.look>0?1.1:4.2);ctx.stroke()}}else if(a.weapon==='hands'){ctx.fillStyle='#aa9366';ctx.fillRect(a.look>0?7:-10,-17,4,3)}
    // hp pip above head for hurt or selected
    if(a.hp<75||selected===a){ctx.fillStyle='#27332c';ctx.fillRect(-9,-42,18,3);ctx.fillStyle=a.hp<35?'#e98b65':'#c2e17d';ctx.fillRect(-8,-41,16*a.hp/100,1)}
    if(selected===a){ctx.font='7px monospace';ctx.textAlign='center';ctx.fillStyle='#18221b';ctx.fillRect(-24,-53,48,9);ctx.fillStyle='#e9efdc';ctx.fillText(a.name.toUpperCase(),0,-46)}
    if(a.flash>0){ctx.globalAlpha=a.flash*2;ctx.fillStyle='#fff1ca';ctx.fillRect(-6,-34,12,28)}ctx.restore();
  }
  function renderUI(force=false){const roster=document.getElementById('rosterList');let list=agents.slice().sort((a,b)=>sortByScore?(b.score-a.score||b.hp-a.hp):(a.id-b.id));
    if(force||uiTimer>0.38){uiTimer=0;document.getElementById('aliveCount').textContent=alive().length;document.getElementById('rosterCount').textContent=alive().length;document.getElementById('fallenCount').textContent=String(deaths).padStart(2,'0')+' ELIMINATED';document.getElementById('clock').textContent=String(Math.floor(simTime/60)).padStart(2,'0')+':'+String(Math.floor(simTime%60)).padStart(2,'0');let pct=clamp((simTime/1000)*100,7,97);document.getElementById('timelineFill').style.width=pct+'%';document.querySelector('.timeline-marker').style.left=pct+'%';document.getElementById('supplyCount').innerHTML=resources.filter(r=>r.amount>0).length+'<span> CACHE</span>';document.getElementById('coordLabel').textContent=`SECTOR ${String(Math.floor(cameraX/530)+1).padStart(2,'0')} — 06`;
      roster.innerHTML=list.map((a,i)=>`<button class="survivor-row ${!a.alive?'dead':''} ${selected===a?'selected':''}" data-id="${a.id}" ${!a.alive?'aria-label="'+a.name+' eliminated"':''}><span class="row-rank">${String(i+1).padStart(2,'0')}</span><span class="avatar" style="--avatar:${palettes[a.id][2]}"><span>${a.name.split(' ').map(s=>s[0]).join('')}</span></span><span class="row-name">${a.name}</span><span class="row-weapon">${a.alive?(a.weapon==='hands'?'BARE':a.weapon.toUpperCase()):'OUT'}</span><span class="row-health"><i class="${a.hp<30?'low':''}" style="width:${a.alive?a.hp:0}%"></i></span><span class="row-score">${a.kills}</span></button>`).join('');
      roster.querySelectorAll('.survivor-row').forEach(el=>el.addEventListener('click',()=>selectAgent(agents[+el.dataset.id])));
      document.getElementById('eventList').innerHTML=events.slice(0,4).map(e=>`<div class="event-item ${e.type}"><span class="event-time">${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(Math.floor(e.time%60)).padStart(2,'0')}</span><span class="event-icon">${e.icon}</span><span>${e.text}</span></div>`).join('');document.getElementById('mobileFeed').innerHTML=events.slice(0,2).map(e=>`<div class="event-item ${e.type}"><span class="event-time">${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(Math.floor(e.time%60)).padStart(2,'0')}</span><span class="event-icon">${e.icon}</span><span>${e.text}</span></div>`).join('');
    }
  }
  function selectAgent(a){if(!a.alive)return;selected=selected===a?null:a;renderUI(true);if(selected){let card=document.getElementById('selectionCard');card.hidden=false;card.innerHTML=`FOLLOWING <b>${selected.name.toUpperCase()}</b> · ${selected.weapon.toUpperCase()} · ${Math.round(selected.hp)} HP`}else document.getElementById('selectionCard').hidden=true}
  function updateControls(){document.getElementById('pauseBtn').innerHTML=paused?'<span class="pause-glyph">▶</span><span>RESUME</span>':'<span class="pause-glyph">Ⅱ</span><span>PAUSE</span>';document.getElementById('speedLabel').textContent=speed+'× SPEED';document.getElementById('speedBtn').querySelector('.speed-glyph').textContent=speed===1?'»':speed===2?'»»':'»»»';document.getElementById('stateLabel').textContent=ended?'THE TRIAL IS COMPLETE':paused?'SIMULATION PAUSED':'THE TRIAL IS LIVE'}
  document.getElementById('pauseBtn').addEventListener('click',()=>{paused=!paused;updateControls()});document.getElementById('speedBtn').addEventListener('click',()=>{speed=speed===1?2:speed===2?4:1;updateControls()});document.getElementById('restartBtn').addEventListener('click',makeWorld);document.getElementById('sortBtn').addEventListener('click',()=>{sortByScore=!sortByScore;renderUI(true)});
  canvas.addEventListener('pointerdown',e=>{let r=canvas.getBoundingClientRect(),scale=canvasH/H,x=cameraX+(e.clientX-r.left)/scale,y=(e.clientY-r.top)/scale;let a=alive().map(a=>({a,d:Math.hypot(a.x-x,(terrainY(a.x)-20)-y)})).sort((a,b)=>a.d-b.d)[0];if(a&&a.d<43)selectAgent(a.a)});
  document.querySelector('.sound-toggle').addEventListener('click',e=>{e.currentTarget.title='Ambient sound is not included';e.currentTarget.style.color='#c0e67b';setTimeout(()=>e.currentTarget.style.color='',450)});
  function loop(now){if(!lastFrame)lastFrame=now;let dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;update(dt);drawWorld();uiTimer+=dt;if(uiTimer>.38)renderUI();requestAnimationFrame(loop)}
  window.addEventListener('resize',resize);resize();makeWorld();requestAnimationFrame(loop);
})();
