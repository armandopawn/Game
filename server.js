const express=require('express'),http=require('http'),path=require('path'),fs=require('fs');
const {Server}=require('socket.io');
const S=require('./public/shared.js');
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static(path.join(__dirname,'public'),{setHeaders:r=>r.setHeader('Cache-Control','no-cache')}));

// ---- ranking persistente (arquivo JSON). No Render grátis o disco é apagado a cada deploy/reinício;
// para manter de verdade, anexe um Disk e defina DATA_DIR para o caminho dele.
const DIR=process.env.DATA_DIR||path.join(__dirname,'data'),FILE=path.join(DIR,'ranking.json');
let R={};try{R=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){}
let dirty=false;
setInterval(()=>{if(!dirty)return;dirty=false;try{fs.mkdirSync(DIR,{recursive:true});fs.writeFileSync(FILE,JSON.stringify(R))}catch(e){console.error('ranking:',e.message)}},10000);
const top=()=>Object.values(R).sort((a,b)=>b.k-a.k).slice(0,10).map(r=>[r.n,r.k,r.d,r.v,r.m]);
function commit(p,win){if(p.bot||!(p.k+p.d))return;const key=p.nome.toLowerCase(),r=R[key]||(R[key]={n:p.nome,k:0,d:0,v:0,m:0});r.k+=p.k;r.d+=p.d;r.m++;if(win)r.v++;p.k=p.d=0;dirty=true}

const NAME=/^[\p{L}\p{N} _.-]{4,20}$/u,now=()=>Date.now();
const NB=Math.max(0,Math.min(10,+process.env.BOTS||5)),NAMES=['Alfa','Bravo','Charlie','Delta','Eco','Foxtrot','Golf','Hotel','India','Juliet'];
const sock=id=>io.sockets.sockets.get(id);

// ---- salas: cada modo tem a sua partida separada ('bots' = com bots, 'pl' = só jogadores).
// Assim um jogador pode estar numa sala e outro entrar na outra, sem travar o seletor de modo.
function makeRoom(key,withBots){
 const P=new Map();let over=false,t0=now(),overAt=0;
 const em=(ev,d)=>io.to(key).emit(ev,d); // só quem está nesta sala
 const mk=(id,nome,bot,g)=>({id,nome,bot,g:g||'m',nh:0,x:0,z:0,yaw:0,pitch:0,hp:0,w:0,ammo:S.W.map(w=>w.mag),rel:0,lf:0,dead:1,k:0,d:0,lm:now(),nf:0,wp:null,wt:0,st:'pat'});
 const lista=()=>em('lista',[...P.values()].map(p=>[p.id,p.nome,p.bot?1:0,p.g]));
 const humans=()=>{let n=0;for(const p of P.values())if(!p.bot)n++;return n};
 if(withBots)for(let i=0;i<NB;i++){const b=mk('bot'+i,'[BOT] '+NAMES[i],true);b.w=i%S.W.length;b.g=i%2?'f':'m';P.set(b.id,b)}

 function spawn(p){let best=S.SPAWN[0],bd=-1;
  for(const s of S.SPAWN){let m=1e9;for(const q of P.values())if(q!==p&&q.dead===0)m=Math.min(m,Math.hypot(q.x-s[0],q.z-s[1]));m+=Math.random();if(m>bd){bd=m;best=s}}
  p.x=best[0];p.z=best[1];p.hp=100;p.dead=0;p.ammo=S.W.map(w=>w.mag);p.rel=0;p.lm=now();p.wp=null;p.nh=now()+5000;
  if(!p.bot){const s=sock(p.id);s&&s.emit('spawn',[p.x,p.z])}}
 function hurt(v,a,amt,t){v.hp-=amt;if(v.hp>0)return;v.hp=0;v.dead=t+3000;v.d++;a.k++;
  if(a.dead===0){a.hp=100;a.nh=t+5000} // matou: vida volta ao máximo
  em('morte',[a.id,v.id,a.w]);if(a.k>=30&&!over)end(a)}
 function end(w){over=true;overAt=now();
  const tab=[...P.values()].sort((a,b)=>b.k-a.k).map(p=>[p.nome,p.bot?1:0,p.k,p.d]);
  for(const p of P.values())commit(p,p===w);
  em('fim',{v:w.nome,tab,dur:Math.round((now()-t0)/1000)});io.emit('rank',top())}
 function reset(){over=false;t0=now();for(const p of P.values()){p.k=p.d=0;p.dead=1}em('inicio')}

 // ---- combate (o servidor decide tudo: arma, munição, cadência, linha de visão, dano)
 function fire(p,yaw,pitch,t){const w=S.W[p.w];
  if(p.dead!==0||over||p.rel)return;
  if(p.ammo[p.w]<=0){p.rel=t+w.rel;return} // sem munição: o servidor inicia a recarga sozinho
  if(t-p.lf<w.rate-Math.max(8,w.rate*.12))return;
  p.lf=t;p.ammo[p.w]--;const o=[p.x,1.6,p.z],pts=[],H=new Map();
  for(let i=0;i<w.pel;i++){
   const yy=yaw+(Math.random()-.5)*w.spr*2,pp=pitch+(Math.random()-.5)*w.spr*2,c=Math.cos(pp),d=[-Math.sin(yy)*c,Math.sin(pp),-Math.cos(yy)*c];
   let m=Math.min(w.rng,S.wall(o,d,w.rng)),tg=null;
   for(const q of P.values()){if(q===p||q.dead!==0)continue;
    for(const cy of[.5,1.3]){const vx=q.x-o[0],vy=cy-o[1],vz=q.z-o[2],tt=vx*d[0]+vy*d[1]+vz*d[2];
     if(tt<0||tt>m)continue;if(vx*vx+vy*vy+vz*vz-tt*tt<.3){m=tt;tg=q}}}
   if(tg)H.set(tg,(H.get(tg)||0)+w.dmg*(1-.5*m/w.rng));
   pts.push(o.map((v,j)=>+(v+d[j]*m).toFixed(1)));}
  em('tiro',[p.id,p.w,pts]);
  let kill=0;
  for(const[v,a]of H){hurt(v,p,a,t);if(v.dead!==0)kill=1;
   else if(!v.bot){const s=sock(v.id);s&&s.emit('dano',p.id)}} // quem levou tiro (e sobreviveu) ouve o som de dano
  if(H.size&&!p.bot){const s=sock(p.id);s&&s.emit('acerto',kill)}}

 // ---- IA dos bots: estados patrulha / perseguição / ataque (+ respawn). Roda no tick de 20 Hz.
 const rp=()=>{for(;;){const x=(Math.random()*2-1)*34,z=(Math.random()*2-1)*34;if(!S.blocked(x,z,.7))return[x,z]}};
 function los(a,q,max){const dx=q.x-a.x,dz=q.z-a.z,dy=-.4,d=Math.hypot(dx,dz);if(d>max)return 0;const L=Math.hypot(d,dy);
  return S.wall([a.x,1.6,a.z],[dx/L,dy/L,dz/L],L)>=L-.2?d:0}
 function ai(b,t,dt){if(b.dead!==0)return;let tg=null,td=35;
  for(const q of P.values()){if(q===b||q.dead!==0)continue;const d=los(b,q,td);if(d&&d<td){td=d;tg=q}}
  let gx,gz;
  if(tg){b.st=td<26?'atk':'chase';gx=tg.x;gz=tg.z;b.yaw=Math.atan2(-(gx-b.x),-(gz-b.z));b.pitch=-.4/td}
  else{b.st='pat';if(!b.wp||Math.hypot(b.wp[0]-b.x,b.wp[1]-b.z)<2||t>b.wt){b.wp=rp();b.wt=t+8000}gx=b.wp[0];gz=b.wp[1];b.yaw=Math.atan2(-(gx-b.x),-(gz-b.z));b.pitch=0}
  let dx=gx-b.x,dz=gz-b.z;const d=Math.hypot(dx,dz)||1;
  if(b.st==='atk'){if(d<12){dx=-dx;dz=-dz}else{const s=Math.sin(t/1200+b.x)>0?1:-1;[dx,dz]=[-dz*s,dx*s]}}
  const sp=3.5*dt,mx=dx/d*sp,mz=dz/d*sp;let mv=0;
  if(!S.blocked(b.x+mx,b.z,.45)){b.x+=mx;mv=1}if(!S.blocked(b.x,b.z+mz,.45)){b.z+=mz;mv=1}if(!mv)b.wp=null;
  if(b.st==='atk'){const w=S.W[b.w];
   if(b.ammo[b.w]<=0){if(!b.rel)b.rel=t+w.rel}
   else if(t>b.nf){fire(b,b.yaw+(Math.random()-.5)*.08,b.pitch+(Math.random()-.5)*.08,t);b.nf=t+w.rate*2+Math.random()*250}}}

 setInterval(()=>{const t=now();let hum=0;
  for(const p of P.values()){if(!p.bot)hum++;
   if(p.rel&&p.rel<=t){p.ammo[p.w]=S.W[p.w].mag;p.rel=0}
   if(p.dead!==0&&p.dead<=t&&!over)spawn(p);
   // sem matar ninguém: +3 de vida a cada 5 s
   if(p.dead===0&&!over){if(p.hp>=100)p.nh=t+5000;else if(t>=p.nh){p.hp=Math.min(100,p.hp+3);p.nh=t+5000}}}
  if(!hum)return;
  if(over&&t-overAt>20000)reset();
  if(!over)for(const p of P.values())if(p.bot)ai(p,t,.05);
  io.to(key).volatile.emit('estado',[...P.values()].map(p=>[p.id,+p.x.toFixed(2),+p.z.toFixed(2),+p.yaw.toFixed(2),+p.pitch.toFixed(2),Math.ceil(p.hp),p.w,p.k,p.d,p.ammo[p.w],p.rel?1:0]));
 },50);

 return{key,P,mk,em,lista,humans,spawn,reset,fire,get over(){return over}};
}
const rooms={bots:makeRoom('bots',true),pl:makeRoom('pl',false)};
// quantos jogadores (humanos) há em cada sala: aparece no seletor de modo do lobby
const info=()=>io.emit('info',{bots:rooms.bots.humans(),pl:rooms.pl.humans()});

// ---- rede
io.on('connection',s=>{
 const L={},lim=(k,ms)=>{const t=now();if(t-(L[k]||0)<ms)return false;L[k]=t;return true};
 let rm=null; // sala em que este jogador está (null = no lobby)
 const leave=()=>{if(!rm)return;const r=rm,p=r.P.get(s.id);rm=null;s.leave(r.key);if(!p)return;commit(p,false);r.P.delete(s.id);r.em('saiu',[s.id,p.nome]);r.lista();info()};
 s.emit('rank',top());s.emit('info',{bots:rooms.bots.humans(),pl:rooms.pl.humans()});
 s.on('entrar',o=>{
  if(typeof o==='string')o={nome:o};
  if(!o||typeof o.nome!=='string'||!lim('e',400)||rm)return;const n=o.nome.trim();
  if(!NAME.test(n)){s.emit('erro','Nome inválido: 4 a 20 letras, números, espaço, _ . -');return}
  const r=o.bots===false?rooms.pl:rooms.bots; // cada jogador escolhe o modo; a sala do modo escolhido recebe ele
  const p=r.mk(s.id,n,false,o.sexo==='f'?'f':'m');
  if(Number.isInteger(o.arma)&&o.arma>=0&&o.arma<S.W.length)p.w=o.arma; // arma escolhida no Arsenal do lobby
  const first=r.humans()===0;
  r.P.set(s.id,p);rm=r;s.join(r.key);
  if(first||r.over)r.reset(); // primeiro a entrar numa sala vazia começa partida zerada; partida encerrada recomeça
  r.spawn(p);s.emit('entrou',s.id);r.em('entrada',[s.id,n]);r.lista();info()});
 s.on('mover',m=>{const p=rm&&rm.P.get(s.id);if(!p||p.dead!==0||rm.over||!m||!lim('m',40))return;
  if(![m.x,m.z,m.yaw,m.pitch].every(Number.isFinite))return;
  const t=now(),dt=Math.min((t-p.lm)/1000,.5);p.lm=t;
  if(Math.hypot(m.x-p.x,m.z-p.z)>6*dt*1.5+.3||S.blocked(m.x,m.z,.4)){s.emit('fix',[p.x,p.z]);return}
  p.x=m.x;p.z=m.z;p.yaw=m.yaw;p.pitch=Math.max(-1.5,Math.min(1.5,m.pitch))});
 s.on('atirar',m=>{const p=rm&&rm.P.get(s.id);if(!p||!m||!Number.isFinite(m.yaw)||!Number.isFinite(m.pitch)||!lim('a',30))return;
  p.yaw=m.yaw;p.pitch=Math.max(-1.5,Math.min(1.5,m.pitch));rm.fire(p,p.yaw,p.pitch,now())});
 s.on('recarregar',()=>{const p=rm&&rm.P.get(s.id);if(!p||p.dead!==0||p.rel||!lim('r',200))return;const w=S.W[p.w];if(p.ammo[p.w]<w.mag)p.rel=now()+w.rel});
 s.on('arma',i=>{const p=rm&&rm.P.get(s.id);if(!p||!Number.isInteger(i)||i<0||i>=S.W.length||!lim('w',200))return;p.w=i;p.rel=0});
 s.on('novaPartida',()=>{if(rm&&rm.over&&lim('n',1000))rm.reset()});
 s.on('sair',leave);s.on('disconnect',leave);
});

const PORT=process.env.PORT||3000;
// 0.0.0.0 é obrigatório no Render (e permite jogar em rede local também)
server.listen(PORT,'0.0.0.0',()=>console.log('Servidor rodando na porta '+PORT));
