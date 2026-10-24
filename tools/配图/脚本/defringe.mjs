import fs from 'node:fs'; import zlib from 'node:zlib';
const [,, keyIn, outp, satArg] = process.argv; const sat=Number(satArg||0.85);
function load(p){const b=fs.readFileSync(p);let o=8,idat=[],w,h,ct;while(o<b.length){const l=b.readUInt32BE(o),t=b.toString('ascii',o+4,o+8);if(t==='IHDR'){w=b.readUInt32BE(o+8);h=b.readUInt32BE(o+12);ct=b[o+17];}if(t==='IDAT')idat.push(b.subarray(o+8,o+8+l));o+=12+l;}
const bpp=ct===6?4:3,raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*bpp,px=Buffer.alloc(h*stride);
for(let y=0;y<h;y++){const f=raw[y*(stride+1)],s=y*(stride+1)+1;for(let x=0;x<stride;x++){const a=x>=bpp?px[y*stride+x-bpp]:0,up=y?px[(y-1)*stride+x]:0,c=(x>=bpp&&y)?px[(y-1)*stride+x-bpp]:0;let v=raw[s+x];if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const pp=a+up-c,pa=Math.abs(pp-a),pb=Math.abs(pp-up),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?up:c);}px[y*stride+x]=v&255;}}
return {w,h,bpp,px};}
const {w,h,bpp,px}=load(keyIn);
const R=(x,y)=>px[(y*w+x)*bpp],G=(x,y)=>px[(y*w+x)*bpp+1],B=(x,y)=>px[(y*w+x)*bpp+2];
// "pinkness": how much both R and B exceed G  -> magenta contamination
const pink=(x,y)=>Math.min(R(x,y),B(x,y))-G(x,y);
const isKey=(x,y)=>{const r=R(x,y),g=G(x,y),b=B(x,y);return r>170&&b>170&&g<110&&(r-g)>110&&(b-g)>110;};
// 1) transparent mask = key pixels OR contaminated pixels (pink>28) connected to key (flood from key, 4-neighbour, grow up to 8px)
const mask=new Uint8Array(w*h); // 1 = remove
const q=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(isKey(x,y)){mask[y*w+x]=1;q.push(y*w+x);}
const dist=new Uint8Array(w*h);let qi=0;
while(qi<q.length){const p=q[qi++],x=p%w,y=(p-x)/w,d=dist[p];if(d>=8)continue;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const n=ny*w+nx;if(mask[n])continue;
    if(pink(nx,ny)>22){mask[n]=1;dist[n]=d+1;q.push(n);}}}
// 2) erode: remove 1px more along the boundary
const m2=mask.slice();for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){if(mask[y*w+x])continue;if(mask[y*w+x-1]||mask[y*w+x+1]||mask[(y-1)*w+x]||mask[(y+1)*w+x])m2[y*w+x]=1;}
// 3) remaining pixels within 4px of boundary: neutralise residual pink by clamping R,B to G+10
const near=new Uint8Array(w*h);{let cur=m2.slice();for(let it=0;it<4;it++){const nx=cur.slice();for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){if(cur[y*w+x])continue;if(cur[y*w+x-1]||cur[y*w+x+1]||cur[(y-1)*w+x]||cur[(y+1)*w+x]){nx[y*w+x]=1;near[y*w+x]=1;}}cur=nx;}}
const out=Buffer.alloc(w*h*4);let fixed=0;
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*4;let r=R(x,y),g=G(x,y),b=B(x,y);
  if(m2[y*w+x]){out[o]=out[o+1]=out[o+2]=0;out[o+3]=0;continue;}
  if(near[y*w+x]){const lim=g+8;if(r>lim){r=lim;fixed++;}if(b>lim){b=lim;fixed++;}}
  { const pk=Math.min(r,b)-g; if(pk>8){ const cut=(pk-8)*0.9; r-=cut; b-=cut; fixed++; } }
  const l=0.3*r+0.59*g+0.11*b;r=l+(r-l)*sat;g=l+(g-l)*sat;b=l+(b-l)*sat;
  out[o]=r;out[o+1]=g;out[o+2]=b;out[o+3]=255;}
const crcT=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcT[n]=c;}
const crc=(b)=>{let c=-1;for(const v of b)c=crcT[(c^v)&255]^(c>>>8);return (c^-1)>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
const rawo=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){rawo[y*(w*4+1)]=0;out.copy(rawo,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
fs.writeFileSync(outp,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(rawo)),chunk('IEND',Buffer.alloc(0))]));
// report residual pink among visible pixels
let vis=0,p1=0,p2=0;for(let i=0;i<w*h;i++){if(out[i*4+3]){vis++;const r=out[i*4],g=out[i*4+1],b=out[i*4+2];const pk=Math.min(r,b)-g;if(pk>20)p1++;if(pk>40)p2++;}}
console.log('visible',vis,'pink>20:',p1,'pink>40:',p2,'clamped',fixed);
