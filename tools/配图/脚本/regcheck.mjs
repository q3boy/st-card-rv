import fs from 'node:fs'; import zlib from 'node:zlib';
function load(p){const b=fs.readFileSync(p);let o=8,idat=[],w,h;while(o<b.length){const l=b.readUInt32BE(o),t=b.toString('ascii',o+4,o+8);if(t==='IHDR'){w=b.readUInt32BE(o+8);h=b.readUInt32BE(o+12);}if(t==='IDAT')idat.push(b.subarray(o+8,o+8+l));o+=12+l;}
const raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*4,px=Buffer.alloc(h*stride);
for(let y=0;y<h;y++){const f=raw[y*(stride+1)],s=y*(stride+1)+1;for(let x=0;x<stride;x++){const a=x>=4?px[y*stride+x-4]:0,up=y?px[(y-1)*stride+x]:0,c=(x>=4&&y)?px[(y-1)*stride+x-4]:0;let v=raw[s+x];if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const pp=a+up-c,pa=Math.abs(pp-a),pb=Math.abs(pp-up),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?up:c);}px[y*stride+x]=v&255;}}
return {w,h,px};}
function grad(img,box){const {w,h,px}=img;const [x0,y0,x1,y1]=box;const W=x1-x0,H=y1-y0;const g=new Float32Array(W*H);
 const L=(x,y)=>{const i=(y*w+x)*4;return 0.3*px[i]+0.59*px[i+1]+0.11*px[i+2];};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const X=x0+x,Y=y0+y;const gx=L(X+1,Y)-L(X-1,Y),gy=L(X,Y+1)-L(X,Y-1);g[y*W+x]=Math.min(60,Math.hypot(gx,gy));}
 return {g,W,H};}
const states=['drive','park','expand'];const times=['dawn','dusk','night'];
const R=8; // search radius
for(const st of states){
  const base=load(`${process.argv[2]}/rv-${st}-day.png`);
  const bbox=[440,380,1240,780];
  const A=grad(base,bbox);
  for(const t of times){
    const img=load(`${process.argv[2]}/rv-${st}-${t}.png`);
    let best=null;
    for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){
      const B=grad(img,[bbox[0]+dx,bbox[1]+dy,bbox[2]+dx,bbox[3]+dy]);
      let sab=0,saa=0,sbb=0;for(let i=0;i<A.g.length;i+=3){const a=A.g[i],b=B.g[i];sab+=a*b;saa+=a*a;sbb+=b*b;}
      const s=sab/Math.sqrt(saa*sbb);if(!best||s>best.s)best={s,dx,dy};
    }
    console.log(`${st}-${t} vs ${st}-day: best shift dx=${best.dx} dy=${best.dy} corr=${best.s.toFixed(3)}`);
  }
}
