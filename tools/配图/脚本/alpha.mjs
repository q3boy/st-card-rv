import fs from 'node:fs'; import zlib from 'node:zlib';
for (const p of process.argv.slice(2)) {
  const b = fs.readFileSync(p); let o = 8, idat = [], w, h, bd, ct;
  while (o < b.length) { const l = b.readUInt32BE(o), t = b.toString('ascii', o+4, o+8);
    if (t==='IHDR'){w=b.readUInt32BE(o+8);h=b.readUInt32BE(o+12);bd=b[o+16];ct=b[o+17];}
    if (t==='IDAT') idat.push(b.subarray(o+8,o+8+l)); o += 12 + l; }
  console.log(p, w+'x'+h, 'bitdepth', bd, 'colortype', ct, '(6=RGBA)');
  if (ct !== 6 || bd !== 8) { console.log('  NO 8-bit RGBA alpha channel'); continue; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = w*bpp;
  const px = Buffer.alloc(h*stride); 
  for (let y=0;y<h;y++){ const f=raw[y*(stride+1)]; const s=y*(stride+1)+1;
    for (let x=0;x<stride;x++){ const a=x>=bpp?px[y*stride+x-bpp]:0, up=y?px[(y-1)*stride+x]:0, c=(x>=bpp&&y)?px[(y-1)*stride+x-bpp]:0; let v=raw[s+x];
      if(f===1)v+=a; else if(f===2)v+=up; else if(f===3)v+=(a+up)>>1; else if(f===4){const pp=a+up-c,pa=Math.abs(pp-a),pb=Math.abs(pp-up),pc=Math.abs(pp-c); v+= (pa<=pb&&pa<=pc)?a:(pb<=pc?up:c);} px[y*stride+x]=v&255; } }
  let z=0,m=0,f=0; for(let i=3;i<px.length;i+=4){const a=px[i]; if(a===0)z++; else if(a===255)f++; else m++;}
  const hist={}; for(let i=3;i<px.length;i+=4){const a=px[i]; hist[a]=(hist[a]||0)+1;} const top=Object.entries(hist).sort((x,y)=>y[1]-x[1]).slice(0,6); console.log("  top alpha values:", top.map(([k,v])=>k+":"+v).join(" "));
  const n=w*h; console.log(`  alpha==0 ${(100*z/n).toFixed(1)}%  semi(1-254) ${(100*m/n).toFixed(1)}%  opaque ${(100*f/n).toFixed(1)}%`);
  console.log('  corner alpha:', px[3], px[(w-1)*4+3], px[(h-1)*stride+3], px[h*stride-1]);
}
