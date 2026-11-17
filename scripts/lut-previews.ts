import {readFile,mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {parseCube,sampleCube} from '../lib/cube';
const manifest=JSON.parse(await readFile('public/luts/manifest.json','utf8')) as {id:string;name:string;url:string;category:string}[];
const {data,info}=await sharp('public/lut-reference.jpg').resize(320,240,{fit:'cover'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
await mkdir('public/look-previews',{recursive:true});
await sharp(data,{raw:info}).webp({quality:90}).toFile('public/look-previews/original.webp');
for(const look of manifest.filter(l=>l.category==='creative')){
  const cube=parseCube(await readFile('public'+look.url,'utf8'));
  const graded=Buffer.alloc(data.length);
  for(let i=0;i<data.length;i+=3){const color=sampleCube(cube,[data[i]/255,data[i+1]/255,data[i+2]/255]);for(let c=0;c<3;c++)graded[i+c]=Math.round(color[c]*255);}
  await sharp(graded,{raw:info}).webp({quality:90}).toFile(`public/look-previews/${look.id}.webp`);
  look.name=look.name.replace(/\.(jpe?g|png)$/i,'');
}
await writeFile('public/luts/manifest.json',JSON.stringify(manifest,null,2));
console.log('Generated fixed reference previews for every creative LUT.');
