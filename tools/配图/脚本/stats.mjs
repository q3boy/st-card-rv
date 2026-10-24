import fs from 'node:fs'; import zlib from 'node:zlib';
function load(p){const b=fs.readFileSync(p);let o=8,idat=[],w,h,ct;while(o<b.length){const l=b.readUInt32BE(o),t=b.toString('ascii',o+4,o+8);if(t==='IHDR'){w=b.readUInt32BE(o+8);h=b.readUInt32BE(o+12);ct=b[o+17];}if(t==='IDAT')idat.push(b.subarray(o+8,o+8+l));o+=12+l;}
const bpp=ct===6?4:3,raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*bpp,px=Buffer.alloc(h*stride);
for(let y=0;y<h;y++){const f=raw[y*(stride+1)],s=y*(stride+1)+1;for(let x=0;x<stride;x++){const a=x>=bpp?px[y*stride+x-bpp]:0,up=y?px[(y-1)*stride+x]:0,c=(x>=bpp&&y)?px[(y-1)*stride+x-bpp]:0;let v=raw[s+x];if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const pp=a+up-c,pa=Math.abs(pp-a),pb=Math.abs(pp-up),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?up:c);}px[y*stride+x]=v&255;}}
return {w,h,bpp,px};}
function stats(p,box){const {w,h,bpp,px}=load(p);let n=0,R=0,G=0,B=0,L=[],S=0;
 const [x0,y0,x1,y1]=box||[0,0,w,h];
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*w+x)*bpp;if(bpp===4&&px[i+3]<250)continue;const r=px[i],g=px[i+1],b=px[i+2];n++;R+=r;G+=g;B+=b;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);S+=mx?(mx-mn)/mx:0;L.push(0.3*r+0.59*g+0.11*b);}
 L.sort((a,b)=>a-b);const m=L.reduce((a,b)=>a+b,0)/n;const sd=Math.sqrt(L.reduce((a,b)=>a+(b-m)**2,0)/n);
 return `n=${n} meanRGB=(${(R/n).toFixed(0)},${(G/n).toFixed(0)},${(B/n).toFixed(0)}) lum mean=${m.toFixed(0)} p5=${L[Math.floor(n*0.05)].toFixed(0)} p95=${L[Math.floor(n*0.95)].toFixed(0)} sd=${sd.toFixed(0)} sat=${(S/n).toFixed(2)}`;}
console.log('scene road   :',stats('scenes/scene-road-day.png'));
console.log('scene camp   :',stats('scenes/scene-camp-day.png'));
console.log('rv drive day :',stats('aligned/vehicle-retracted-driving-day.png'));
console.log('rv park day  :',stats('aligned/vehicle-retracted-parked-day.png'));
