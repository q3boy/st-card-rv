import fs from 'node:fs'; import zlib from 'node:zlib';
const [,, inp, outp, ratioArg, satArg] = process.argv;
const ratio=Number(ratioArg||0.1), sat=Number(satArg||0.8);
function load(p){const b=fs.readFileSync(p);let o=8,idat=[],w,h,ct;while(o<b.length){const l=b.readUInt32BE(o),t=b.toString('ascii',o+4,o+8);if(t==='IHDR'){w=b.readUInt32BE(o+8);h=b.readUInt32BE(o+12);ct=b[o+17];}if(t==='IDAT')idat.push(b.subarray(o+8,o+8+l));o+=12+l;}
const bpp=ct===6?4:3,raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*bpp,px=Buffer.alloc(h*stride);
for(let y=0;y<h;y++){const f=raw[y*(stride+1)],s=y*(stride+1)+1;for(let x=0;x<stride;x++){const a=x>=bpp?px[y*stride+x-bpp]:0,up=y?px[(y-1)*stride+x]:0,c=(x>=bpp&&y)?px[(y-1)*stride+x-bpp]:0;let v=raw[s+x];if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const pp=a+up-c,pa=Math.abs(pp-a),pb=Math.abs(pp-up),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?up:c);}px[y*stride+x]=v&255;}}
return {w,h,bpp,px};}
const {w,h,bpp,px}=load(inp);
const isKey=(x,y)=>{const i=(y*w+x)*bpp;const r=px[i],g=px[i+1],b=px[i+2];return r>170&&b>170&&g<110&&(r-g)>110&&(b-g)>110;};
// per-column sky mask (connected from top): sky = key pixels from the top down until first non-key (run of 3 non-key)
const ridge=new Int32Array(w);
for(let x=0;x<w;x++){let y=0;while(y<h-3&&(isKey(x,y)||isKey(x,y+1)||isKey(x,y+2)))y++;ridge[x]=y;}
// smooth ridge with small median (5) to kill speckle, then erode 2px
const rs=new Int32Array(w);for(let x=0;x<w;x++){const a=[];for(let k=-2;k<=2;k++)a.push(ridge[Math.min(w-1,Math.max(0,x+k))]);a.sort((p,q)=>p-q);rs[x]=a[2]+2;}
const out=Buffer.alloc(w*h*4);
for(let x=0;x<w;x++){
  const valid=h-rs[x];const fade=Math.max(1,Math.round(valid*ratio));
  for(let y=0;y<h;y++){
    const i=(y*w+x)*bpp, o=(y*w+x)*4;
    let r=px[i],g=px[i+1],b=px[i+2],a;
    const d=y-rs[x];
    if(d<0)a=0;else{const t=Math.min(1,d/fade);a=255*t*t*(3-2*t);}
    // de-fringe: near ridge, pull magenta tint out (reduce red/blue excess over green)
    if(d>=0&&d<6){const m=Math.max(0,Math.min(r,b)-g);r-=m*0.8;b-=m*0.8;}
    // desaturate
    const l=0.3*r+0.59*g+0.11*b;r=l+(r-l)*sat;g=l+(g-l)*sat;b=l+(b-l)*sat;
    out[o]=Math.max(0,Math.min(255,r));out[o+1]=Math.max(0,Math.min(255,g));out[o+2]=Math.max(0,Math.min(255,b));out[o+3]=Math.round(a);
  }}
const crcT=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcT[n]=c;}
const crc=(b)=>{let c=-1;for(const v of b)c=crcT[(c^v)&255]^(c>>>8);return (c^-1)>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
const rawo=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){rawo[y*(w*4+1)]=0;out.copy(rawo,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
fs.writeFileSync(outp,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(rawo)),chunk('IEND',Buffer.alloc(0))]));
const mn=Math.min(...rs),mx=Math.max(...rs);console.log('ridge y',mn,mx,'fade px',Math.round((h-mn)*ratio),Math.round((h-mx)*ratio));
