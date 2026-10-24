import fs from 'node:fs'; import zlib from 'node:zlib';
function load(p){const b=fs.readFileSync(p);let o=8,idat=[],w,h;while(o<b.length){const l=b.readUInt32BE(o),t=b.toString('ascii',o+4,o+8);if(t==='IHDR'){w=b.readUInt32BE(o+8);h=b.readUInt32BE(o+12);}if(t==='IDAT')idat.push(b.subarray(o+8,o+8+l));o+=12+l;}
const raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*4,px=Buffer.alloc(h*stride);
for(let y=0;y<h;y++){const f=raw[y*(stride+1)],s=y*(stride+1)+1;for(let x=0;x<stride;x++){const a=x>=4?px[y*stride+x-4]:0,up=y?px[(y-1)*stride+x]:0,c=(x>=4&&y)?px[(y-1)*stride+x-4]:0;let v=raw[s+x];if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const pp=a+up-c,pa=Math.abs(pp-a),pb=Math.abs(pp-up),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?up:c);}px[y*stride+x]=v&255;}}
return {w,h,px};}
for(const p of process.argv.slice(2)){const {w,h,px}=load(p);const A=(x,y)=>px[(y*w+x)*4+3];
let minX=w,maxX=0,minY=h,maxY=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(A(x,y)>200){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
// bottom band: opaque columns in last 60px above maxY
let bl=w,br=0;for(let y=maxY-60;y<=maxY;y++)for(let x=0;x<w;x++)if(A(x,y)>200){if(x<bl)bl=x;if(x>br)br=x;}
console.log(JSON.stringify({f:p.split('/').pop(),w,h,minX,maxX,minY,maxY,bandL:bl,bandR:br}));}
