import fs from 'node:fs'; import zlib from 'node:zlib';
function load(p){const b=fs.readFileSync(p);let o=8,idat=[],w,h,ct;while(o<b.length){const l=b.readUInt32BE(o),t=b.toString('ascii',o+4,o+8);if(t==='IHDR'){w=b.readUInt32BE(o+8);h=b.readUInt32BE(o+12);ct=b[o+17];}if(t==='IDAT')idat.push(b.subarray(o+8,o+8+l));o+=12+l;}
const bpp=ct===6?4:3,raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*bpp,px=Buffer.alloc(h*stride);
for(let y=0;y<h;y++){const f=raw[y*(stride+1)],s=y*(stride+1)+1;for(let x=0;x<stride;x++){const a=x>=bpp?px[y*stride+x-bpp]:0,up=y?px[(y-1)*stride+x]:0,c=(x>=bpp&&y)?px[(y-1)*stride+x-bpp]:0;let v=raw[s+x];if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const pp=a+up-c,pa=Math.abs(pp-a),pb=Math.abs(pp-up),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?up:c);}px[y*stride+x]=v&255;}}
return {w,h,bpp,px};}
const hue=(r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;if(!d)return 0;let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;return Math.round(((h*60)+360)%360);};
function avg(p,box){const {w,h,bpp,px}=load(p);let R=0,G=0,B=0,n=0;const [x0,y0,x1,y1]=box||[0,0,w,h];for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*w+x)*bpp;if(bpp===4&&px[i+3]<250)continue;R+=px[i];G+=px[i+1];B+=px[i+2];n++;}R/=n;G/=n;B/=n;return `rgb(${R.toFixed(0)},${G.toFixed(0)},${B.toFixed(0)}) hue=${hue(R,G,B)}`;}
const S='fused/';
for(const f of ['road-drive-night','camp-park-night','camp-expand-night']){
  console.log(f.padEnd(18),'whole:',avg(S+f+'.png'),'| ground band:',avg(S+f+'.png',[0,700,1586,992]));}
const sh='../rv-statusbar-design/shots/';
for(const f of ['overview-dawn','overview-day','overview-dusk','overview-night']){try{console.log('card',f,avg(sh+f+'.png',[480,1380,560,1440]));}catch(e){console.log(f,'n/a')}}
