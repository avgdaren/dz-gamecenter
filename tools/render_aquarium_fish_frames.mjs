/* Author: GPT / Codex. Original plugin (C) 2026 Carinoasd. Offline only. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const warp=require('../source/plugin/gamecenter/games/aquarium/fish-warp.js');
const job=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for(const item of job.items){
  const input=new Uint8Array(fs.readFileSync(item.raw));
  for(let i=0;i<job.frames;i++){
    const data=warp.frame(input,job.size,job.size,2*Math.PI*i/job.frames,item.warp);
    fs.writeFileSync(path.join(job.output,item.id+'-'+String(i).padStart(2,'0')+'.rgba'),data);
  }
}
console.log(JSON.stringify({fish:job.items.length,frames:job.frames,total:job.frames*job.items.length}));
