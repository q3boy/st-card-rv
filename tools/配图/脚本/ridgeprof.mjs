import fs from 'node:fs'; import zlib from 'node:zlib';
function load(p){const b=fs.readFileSync(p);let o=8,idat=[],w,h;while(o<b.length){const l=b.readUInt32BE(o),t=b.toString('ascii',o+4,o+8);if(t==='IHDR'){w=b.readUInt32BE(o+8);h=b.readUInt32BE(o+12);}if(t==='IDAT')idat.push(b.subarray(o+8,o+8+l));o+=12+l;}
const raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*4,px=Buffer.alloc(h*stride);
for(let y=0;y<h;y++){const f=raw[y*(stride+1)],s=y*(stride+1)+1;for(let x=0;x<stride;x++){const a=x>=4?px[y*stride+x-4]:0,up=y?px[(y-1)*stride+x]:0,c=(x>=4&&y)?px[(y-1)*stride+x-4]:0;let v=raw[s+x];if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const pp=a+up-c,pa=Math.abs(pp-a),pb=Math.abs(pp-up),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?up:c);}px[y*stride+x]=v&255;}}
return {w,h,px};}
for(const p of process.argv.slice(2)){const {w,h,px}=load(p);const r=[];for(let x=0;x<w;x++){let y=0;while(y<h&&px[(y*w+x)*4+3]<128)y++;r.push(y);}
 let mn=1e9,mx=0;for(const v of r){if(v<mn)mn=v;if(v>mx)mx=v;}
 const s=[];for(let x=0;x<w;x+=132)s.push(r[x]);
 // roughness: mean abs second difference (to confirm smooth)
 let rough=0;for(let x=2;x<w;x++)rough+=Math.abs(r[x]-2*r[x-1]+r[x-2]);
 console.log(p.split('/').pop(),'ridge y min',mn,'max',mx,'range',mx-mn,'samples',s.join(','),'roughness',(rough/w).toFixed(2));}
