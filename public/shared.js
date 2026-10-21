(function(g){
const S={R:40,
// caixas: [centroX, centroZ, largura, profundidade, altura]
BOX:[[0,0,6,6,4],[-18,10,10,3,3],[16,-12,3,12,3],[-10,-20,8,3,3],[22,18,6,6,6],[-26,-6,3,10,3],[8,16,4,4,2],[-4,-9,4,4,2],[-22,26,5,5,6],[28,-28,8,3,3],
// extras (cobertura baixa: sacos de areia, caixas e contêiner baixo)
[-8,26,6,2,1.5],[12,30,2,6,1.5],[30,4,2,8,1.5],[-30,-24,6,2,1.5],[-14,-6,2,2,1.6],[14,6,2,2,1.6],[0,20,10,2,2.2],[-8,-30,6,2,1.5]],
SPAWN:[[-34,-34],[34,-34],[-34,34],[34,34],[0,-36],[0,36],[-36,0],[36,0]],
// auto:1 = segurar o gatilho continua atirando; auto:0 = um clique, um tiro (semi-automática)
W:[{n:'Rifle',dmg:34,rate:300,mag:20,rel:1800,rng:80,pel:1,spr:.008,auto:0},
   {n:'SMG',dmg:12,rate:65,mag:35,rel:1500,rng:45,pel:1,spr:.03,auto:1},
   {n:'Espingarda',dmg:9,rate:800,mag:8,rel:2200,rng:25,pel:8,spr:.07,auto:0},
   {n:'AK-47',dmg:24,rate:105,mag:30,rel:1900,rng:65,pel:1,spr:.018,auto:1}]};
S.blocked=(x,z,r)=>{if(Math.abs(x)>S.R-r||Math.abs(z)>S.R-r)return true;for(const b of S.BOX)if(Math.abs(x-b[0])<b[2]/2+r&&Math.abs(z-b[1])<b[3]/2+r)return true;return false};
S.rayBox=(o,d,b,max)=>{let t0=0,t1=max;const mn=[b[0]-b[2]/2,0,b[1]-b[3]/2],mx=[b[0]+b[2]/2,b[4],b[1]+b[3]/2];
for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-9){if(o[i]<mn[i]||o[i]>mx[i])return Infinity}else{let a=(mn[i]-o[i])/d[i],c=(mx[i]-o[i])/d[i];if(a>c)[a,c]=[c,a];t0=Math.max(t0,a);t1=Math.min(t1,c);if(t0>t1)return Infinity}}return t0};
S.wall=(o,d,max)=>{let m=max;for(const b of S.BOX){const t=S.rayBox(o,d,b,m);if(t<m)m=t}return m};
if(typeof module!=='undefined')module.exports=S;else g.ZP=S;
})(this);
