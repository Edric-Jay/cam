import {readFile,mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {parseCube,sampleCube} from '../lib/cube';
const manifest=JSON.parse(await readFile('public/luts/manifest.json','utf8')) as {id:string;name:string;url:string;category:string;previewUrl?:string;referencePreviewUrl?:string}[];
const reference=await readFile('public/lut-reference.jpg');
const version=createHash('sha256').update(reference).digest('hex').slice(0,12);
const {data,info}=await sharp(reference).rotate().resize(320,240,{fit:'cover',position:'centre'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
await mkdir('public/look-previews',{recursive:true});
const referenceUrl=`/look-previews/${version}-original.webp`;
await sharp(data,{raw:info}).webp({quality:90}).toFile('public'+referenceUrl);
for(const look of manifest.filter(l=>l.category==='creative')){
  const cube=parseCube(await readFile('public'+look.url,'utf8'));
  const graded=Buffer.alloc(data.length);
  for(let i=0;i<data.length;i+=3){const color=sampleCube(cube,[data[i]/255,data[i+1]/255,data[i+2]/255]);for(let c=0;c<3;c++)graded[i+c]=Math.round(color[c]*255);}
  look.previewUrl=`/look-previews/${version}-${look.id}.webp`;
  look.referencePreviewUrl=referenceUrl;
  await sharp(graded,{raw:info}).webp({quality:90}).toFile('public'+look.previewUrl);
  look.name=look.name.replace(/\.(jpe?g|png)$/i,'');
}
await writeFile('public/luts/manifest.json',JSON.stringify(manifest,null,2));
console.log('Generated fixed reference previews for every creative LUT.');
