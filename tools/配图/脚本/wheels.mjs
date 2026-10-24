import fs from 'node:fs'; import zlib from 'node:zlib';
const p=process.argv[2];const b=fs.readFileSync(p);let o=8,idat=[],w,h;while(o<b.length){const l=b.readUInt32BE(o),t=b.toString('ascii',o+4,o+8);if(t==='IHDR'){w=b.readUInt32BE(o+8);h=b.readUInt32BE(o+12);}if(t==='IDAT')idat.push(b.subarray(o+8,o+8+l));o+=12+l;}
const raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*4,px=Buffer.alloc(h*stride);
for(let y=0;y<h;y++){const f=raw[y*(stride+1)],s=y*(stride+1)+1;for(let x=0;x<stride;x++){const a=x>=4?px[y*stride+x-4]:0,up=y?px[(y-1)*stride+x]:0,c=(x>=4&&y)?px[(y-1)*stride+x-4]:0;let v=raw[s+x];if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const pp=a+up-c,pa=Math.abs(pp-a),pb=Math.abs(pp-up),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?up:c);}px[y*stride+x]=v&255;}}
// lowest opaque (alpha>240) pixel per 40px column band
const out=[];for(let x0=150;x0<1650;x0+=75){let my=0;for(let x=x0;x<x0+40;x++)for(let y=h-1;y>0;y--){if(px[(y*w+x)*4+3]>240){if(y>my)my=y;break;}}out.push(`${x0}:${my}`);}
console.log(out.join(' '));
