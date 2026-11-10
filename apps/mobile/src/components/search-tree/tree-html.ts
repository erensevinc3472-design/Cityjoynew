import { TREE_IMAGE } from './tree-image';

/** Uygulamadan ışık katmanına giden mesajlar. Koordinatlar katmanın kendi alanına göre (CSS piksel). */
export type TreeCommand =
  | { type: 'box'; x0: number; x1: number; y: number; minTop: number }
  | { type: 'dim'; on: boolean }
  | { type: 'pause'; on: boolean };

/** Işık katmanından uygulamaya gelen mesajlar: hazır, bir ışık tanesi kutuya vardı, (hareketsiz modda) kutu yandı. */
export type TreeEvent = { type: 'ready' } | { type: 'arrive' } | { type: 'lit' };

/**
 * Ara ekranının ağaç sahnesi (Eren onayladı, 10 Kasım 2026; taslak "Ara ağacı"): kökler yanar, ışık gövdeden dallara
 * çıkar, dal uçlarından bir kez taneler hâlinde arama kutusuna uçar; kutu yandıktan sonra kökler sakinleşir, ışık
 * gövdede dolaşmaya devam eder. Çizgi yok: resimde kahverengi olan yerler (kabuk) içeriden aydınlanır.
 * Arama kutusu ve yazılar uygulamanın kendi parçalarıdır; bu sayfa yalnız resmi ve ışığı çizer.
 */
export function treeHtml(reduce: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
html,body{margin:0;height:100%;overflow:hidden;background:#062227;-webkit-user-select:none;user-select:none}
body{background:linear-gradient(180deg,#012328 0%,#042C32 24%,#0B3333 42%,#0A2A24 56%,#0C2A27 76%,#001C1F 100%)}
#stage{position:absolute;transform-origin:50% 68%;animation:breathe 9s ease-in-out infinite}
@keyframes breathe{50%{transform:scale(1.012)}}
#stage.edge{-webkit-mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent);mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)}
#stage>*{position:absolute;inset:0;width:100%;height:100%;display:block}
#art{transition:filter .5s ease}
.l{mix-blend-mode:screen;transition:opacity .5s ease}
#pool{left:4%;right:4%;width:auto;top:62.5%;height:10.5%;border-radius:50%;opacity:0;mix-blend-mode:screen;background:radial-gradient(50% 50% at 50% 50%,rgba(255,170,70,.6),rgba(255,140,40,.22) 45%,transparent 75%)}
#sparks{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen}
body.dim #art{filter:brightness(.3) saturate(.7)}
body.dim .l,body.dim #pool,body.dim #sparks{opacity:.2!important}
${reduce ? '#stage{animation:none}' : ''}
</style></head><body>
<div id="stage"><img id="art" alt="" src="${TREE_IMAGE}"><div id="pool"></div>
<canvas class="l" id="bloom" width="450" height="876" style="filter:blur(8px);opacity:.95"></canvas>
<canvas class="l" id="glow" width="450" height="876"></canvas></div>
<canvas id="sparks"></canvas>
<script>
(function(){
var REDUCE=${reduce ? 'true' : 'false'};
var send=function(m){var s=JSON.stringify(m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else if(window.parent!==window)window.parent.postMessage({cityjoyTree:m},'*');};
var stage=document.getElementById('stage'),img=document.getElementById('art'),pool=document.getElementById('pool');
var cv=document.getElementById('glow'),bl=document.getElementById('bloom'),sp=document.getElementById('sparks');
var ctx=cv.getContext('2d'),bctx=bl.getContext('2d'),sctx=sp.getContext('2d');
var W=450,H=876,S=W/900;
function mk(){var c=document.createElement('canvas');c.width=W;c.height=H;return c;}
var mask=mk(),mctx=mask.getContext('2d'),lit=mk();

// Işığın izlediği yollar (resmin 900x1752 koordinatında); her biri küp eğri, önceden noktalara bölünür.
var PATHS={
 trunk:[440,1185,430,1100,418,1000,440,905],
 b0:[436,900,420,835,382,780,350,708], b1:[448,895,488,835,520,782,505,716], b2:[462,900,505,815,560,760,615,712],
 b3:[468,935,560,902,640,868,705,820], b4:[428,918,380,890,320,860,258,830],
 r0:[85,1165,200,1160,340,1162,435,1180], r1:[112,1202,230,1200,350,1192,436,1185], r2:[300,1252,350,1226,400,1206,437,1188],
 r3:[600,1255,540,1226,480,1206,445,1188], r4:[790,1205,680,1200,540,1192,447,1185], r5:[800,1165,690,1160,550,1162,447,1180]};
var BR=['b0','b1','b2','b3','b4'],RT=['r0','r1','r2','r3','r4','r5'],TBL={};
function cub(p,t){var u=1-t;return{x:u*u*u*p[0]+3*u*u*t*p[2]+3*u*t*t*p[4]+t*t*t*p[6],y:u*u*u*p[1]+3*u*u*t*p[3]+3*u*t*t*p[5]+t*t*t*p[7]};}
Object.keys(PATHS).forEach(function(k){var p=PATHS[k],pts=[],len=[0],N=64;for(var i=0;i<=N;i++){pts.push(cub(p,i/N));if(i)len.push(len[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y));}TBL[k]={pts:pts,len:len};});
// Yol boyunca eşit uzaklıkta nokta (u: 0..1).
function at(k,u){var T=TBL[k],L=T.len,tot=L[L.length-1],d=Math.max(0,Math.min(1,u))*tot,i=1;while(i<L.length-1&&L[i]<d)i++;var a=T.pts[i-1],b=T.pts[i],f=(d-L[i-1])/((L[i]-L[i-1])||1);return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}

var ok=true;
function buildLit(){var t=mk().getContext('2d');t.drawImage(img,0,0,W,H);var d;try{d=t.getImageData(0,0,W,H);}catch(e){ok=false;return;}
 var px=d.data;for(var i=0;i<px.length;i+=4){var r=px[i],g=px[i+1],b=px[i+2],bark=Math.max(0,(r-g)+(r-b)*.6)/24,lum=(r+g+b)/765;
 var a=Math.min(1,Math.max(Math.pow(Math.min(1,bark),.7),bark>.05?.12:0))*Math.min(1,.5+lum*1.8);px[i]=255;px[i+1]=150+lum*105;px[i+2]=55+lum*90;px[i+3]=a*255;}
 lit.getContext('2d').putImageData(d,0,0);}
function blob(c,x,y,r,a,rgb){if(a<=0||r<=0)return;rgb=rgb||'255,255,255';var g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba('+rgb+','+Math.min(1,a)+')');g.addColorStop(1,'rgba('+rgb+',0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
function ease(x){return x<=0?0:x>=1?1:x*x*(3-2*x);}
function along(k,u,r,a){var p=at(k,u);blob(mctx,p.x*S,p.y*S,r,a);}

// Yerleşim: resim ekranı kaplar (gerekirse yanları kırpılır); geniş ekranda ortada durur, yanları sise erir.
// Ağacın tepesi arama kutusunun altında kalır (minTop).
var L={s:1,ox:0,oy:0,W:0,H:0},box=null;
function layout(){var Wv=innerWidth,Hv=innerHeight,s=Math.max(Hv/1752,Math.min(Wv/900,Hv/1400)),w=900*s,h=1752*s,ox=(Wv-w)/2,oy=(Hv-h)/2;
 if(box&&box.minTop)oy=Math.max(oy,box.minTop-540*s);
 L={s:s,ox:ox,oy:oy,W:Wv,H:Hv};stage.style.left=ox+'px';stage.style.top=oy+'px';stage.style.width=w+'px';stage.style.height=h+'px';
 stage.classList.toggle('edge',w<Wv-2);var dpr=Math.min(2,devicePixelRatio||1);sp.width=Wv*dpr;sp.height=Hv*dpr;sctx.setTransform(dpr,0,0,dpr,0,0);}
addEventListener('resize',layout);
function view(p){return{x:p.x*L.s+L.ox,y:p.y*L.s+L.oy};}

// Işık taneleri: dal ucundan çıkar, yaprakların arasından süzülüp arama kutusunun alt kenarına varır.
var motes=[];
function spawnMote(k,now,delay){var tip=view(at(k,1)),b=box||{x0:L.W*.15,x1:L.W*.85,y:L.H*.2},m=Math.min(40,(b.x1-b.x0)*.12);
 var tx=b.x0+m+Math.random()*(b.x1-b.x0-2*m),ty=b.y-3,sc=L.s;
 motes.push({start:now+(delay||0),dur:1700+Math.random()*900,p:[tip,{x:tip.x+(Math.random()-.5)*140*sc,y:tip.y-(170+Math.random()*80)*sc},{x:tx+(Math.random()-.5)*160*sc,y:ty+(140+Math.random()*60)*sc},{x:tx,y:ty}],size:(12+Math.random()*7)*sc,ph:Math.random()*6.28});}
function bez(p,t){var u=1-t;return{x:u*u*u*p[0].x+3*u*u*t*p[1].x+3*u*t*t*p[2].x+t*t*t*p[3].x,y:u*u*u*p[0].y+3*u*u*t*p[1].y+3*u*t*t*p[2].y+t*t*t*p[3].y};}
function drawMotes(now){sctx.clearRect(0,0,L.W,L.H);if(!motes.length)return;sctx.globalCompositeOperation='lighter';
 motes=motes.filter(function(m){var e=now-m.start;if(e<0)return true;var t=e/m.dur;if(t>=1){send({type:'arrive'});return false;}
  var tt=t*t*(3-2*t)*.6+t*.4;for(var j=7;j>=0;j--){var q=Math.max(0,tt-j*.024),p=bez(m.p,q),wob=Math.sin(m.ph+q*9)*14*L.s*Math.sin(q*Math.PI);
   var fade=(1-j/8)*Math.min(1,t*5)*(t>.9?(1-t)*10*.6+.4:1);blob(sctx,p.x+wob,p.y,m.size*(j?.7:1.4),(j?.24:1)*fade,'255,196,110');if(!j)blob(sctx,p.x+wob,p.y,m.size*.35,fade,'255,246,225');}
  return true;});sctx.globalCompositeOperation='source-over';}

var t0=0,raf=0,paused=false,started=false,burst=false;
function frame(now){var t=REDUCE?1e9:now-t0,breath=REDUCE?1:.86+.14*Math.sin(now/950);mctx.clearRect(0,0,W,H);
 // Kökler: tabanda güçlü bir kor yanar, ışık bütün köklere yayılır; kutu yandıktan sonra (~5,5 sn) sakin bir kora iner.
 var ign=ease(t/1500),settle=REDUCE?1:ease((t-5500)/1800),deep=ign*breath*(1-.6*settle);
 mctx.save();mctx.translate(222,595);mctx.scale(1,.3);blob(mctx,0,0,80+200*ign,Math.min(1,1.15*deep));mctx.restore();blob(mctx,220,585,60*ign,deep);
 RT.forEach(function(r,i){var spread=ease((t-200-i*90)/1300);for(var j=0;j<=14&&j/14<=spread;j++)along(r,1-j/14,19,.6*breath*(1-.6*settle));
  if(spread>=1&&settle<1){var u=((now/2600)+i*.37)%1;along(r,u,22,.75*Math.sin(u*Math.PI)*(1-settle));}});
 pool.style.opacity=(.95*deep).toFixed(3);
 // Gövde: ışık köklerden yukarı tırmanır; sonra dibinden yukarı ağır dalgalar yükselip bir dala geçer ve söner.
 var climb=ease((t-1000)/1600);for(var i=0;i<=24&&i/24<=climb;i++)along('trunk',i/24,28,(.78-(i/24)*.38)*breath);
 if(climb>0&&climb<1)along('trunk',climb,38,.9);
 if(settle>0&&!REDUCE){for(var n=0;n<3;n++){var cyc=now/3400+n/3,s1=(cyc%1)*1.5,k=BR[(Math.floor(cyc)*2+n*2)%5];
  if(s1<1)along('trunk',s1,30,.8*Math.sin(Math.min(1,s1*1.6)*Math.PI/2)*settle);else along(k,(s1-1)*1.6,22,.75*(1-(s1-1)*2)*settle);}}
 // Dallar: ışık bütün dallara yayılır; uçlara varınca taneler bir kez kutuya yükselir.
 BR.forEach(function(k,i){var u=ease((t-2500-i*160)/1000);if(u<=0)return;for(var j=0;j<=12&&j/12<=u;j++)along(k,j/12,16,.32*breath);if(u<1)along(k,u,28,.9);else along(k,1,18,.5*breath);});
 if(!burst&&t>3500&&!REDUCE){burst=true;BR.forEach(function(k,i){spawnMote(k,now,i*140);spawnMote(k,now,380+i*160);});}
 ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,W,H);ctx.drawImage(lit,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);
 bctx.clearRect(0,0,W,H);bctx.drawImage(cv,0,0);drawMotes(now);
 if(!REDUCE&&!paused)raf=requestAnimationFrame(frame);}

function start(){if(started)return;started=true;buildLit();layout();send({type:'ready'});if(!ok){send({type:'lit'});return;}
 t0=performance.now();if(REDUCE){frame(t0);send({type:'lit'});return;}raf=requestAnimationFrame(frame);}
function onMsg(e){var m=e.data;if(typeof m==='string'){try{m=JSON.parse(m);}catch(x){return;}}if(m&&m.cityjoyTree)m=m.cityjoyTree;if(!m||!m.type)return;
 if(m.type==='box'){box=m;layout();}
 else if(m.type==='dim')document.body.classList.toggle('dim',!!m.on);
 else if(m.type==='pause'){paused=!!m.on;cancelAnimationFrame(raf);if(!paused&&started&&ok&&!REDUCE)raf=requestAnimationFrame(frame);}}
addEventListener('message',onMsg);document.addEventListener('message',onMsg);
layout();
if(img.complete&&img.naturalWidth)start();else img.addEventListener('load',start);
})();
</script></body></html>`;
}
