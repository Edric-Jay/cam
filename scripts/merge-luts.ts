import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { parseCube, type Cube } from '../lib/cube';

// Merge into the catalog: existing IDs, favorites, URLs and technical LUTs survive.
const source = process.argv[2];
if (!source) throw new Error('Usage: tsx scripts/merge-luts.ts <archive-directory>');
const manifestPath = 'public/luts/manifest.json';
type Look = { id: string; name: string; url: string; category: string; sources: string[]; [key: string]: unknown };
const manifest: Look[] = JSON.parse(await readFile(manifestPath, 'utf8'));
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
function fingerprint(cube: Cube) {
  return createHash('sha256').update(JSON.stringify([cube.size,cube.min,cube.max]))
    .update(new Uint8Array(cube.data.buffer)).digest('hex');
}
const seen = new Map<string, Look>();
const names = new Set(manifest.map(look=>look.name));
for (const look of manifest) seen.set(fingerprint(parseCube(await readFile('public'+look.url,'utf8'))),look);
const report: { archive: string; entry?: string; status: string; id?: string; name?: string }[] = [];
const catalog = 'https://www.freepresets.com/product-category/free-luts-color-lookup-table/';
await mkdir('public/lutsv2', { recursive: true });
let added = 0;
for (const archive of (await readdir(source)).filter(f=>/\.(zip|php)$/i.test(f)).sort()) {
  const entries = unzipSync(await readFile(path.join(source,archive)), {filter:f=>
    (/\.cube$/i.test(f.name) || /LUT$/i.test(f.name)) && f.originalSize < 30_000_000 &&
    !f.name.split(/[\\/]/).some(p=>p==='__MACOSX'||p.startsWith('._'))});
  if (!Object.keys(entries).length) report.push({archive,status:'No supported cube files'});
  for (const [entry,bytes] of Object.entries(entries)) {
    try {
      const cube = parseCube(new TextDecoder().decode(bytes));
      const key = fingerprint(cube);
      const existing = seen.get(key);
      if (existing) { report.push({archive,entry,status:'Duplicate skipped',id:existing.id,name:existing.name}); continue; }
      const hash = digest(bytes), id = hash.slice(0,20);
      const baseName = (cube.title || path.basename(entry).replace(/\.cube$/i,''))
        .replace(/^(Presetpro|Stockpresets)(\.com)?\s*-\s*/i,'').replace(/\.(jpe?g|png)$/i,'').trim();
      let name = baseName, variant = 2;
      while (names.has(name)) name = `${baseName} (${variant++})`;
      names.add(name);
      const look: Look = {id,name,url:`/lutsv2/${id}.cube`,bytes:bytes.length,hash,gridSize:cube.size,
        category:'creative',input:'Unspecified by vendor; display RGB assumption',
        output:'Vendor-defined; verify against reference',compatibility:'unverified-display-rgb',
        sources:[`${archive}!${entry}`],sourceUrl:catalog,
        attribution:/stockpresets/i.test(entry)?'Stockpresets via Freepresets.com':'Presetpro via Freepresets.com'};
      await writeFile('public'+look.url,bytes);
      manifest.push(look); seen.set(key,look); added++;
      report.push({archive,entry,status:'Added',id,name});
    } catch (error) { report.push({archive,entry,status:`Rejected: ${String(error)}`}); }
  }
}
manifest.sort((a,b)=>a.name.localeCompare(b.name));
await writeFile(manifestPath,JSON.stringify(manifest,null,2));
await writeFile('freepresets-import-report.json',JSON.stringify({catalog,added,duplicates:report.filter(r=>r.status==='Duplicate skipped').length,total:manifest.length,report},null,2));
console.log(JSON.stringify({added,duplicates:report.filter(r=>r.status==='Duplicate skipped').length,total:manifest.length,rejected:report.filter(r=>r.status.startsWith('Rejected'))}));
