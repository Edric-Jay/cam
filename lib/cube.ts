export type Cube = { title: string; size: number; min: [number,number,number]; max: [number,number,number]; data: Float32Array };
export function parseCube(text: string): Cube {
  let size = 0, title = ''; let min: Cube['min'] = [0,0,0], max: Cube['max'] = [1,1,1]; const values: number[] = [];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim(); if (!line) continue;
    const [key,...args] = line.split(/\s+/);
    if (key === 'TITLE') { title = args.join(' ').replace(/^"|"$/g, ''); continue; }
    if (key === 'LUT_1D_SIZE' || key.includes('INPUT_RANGE')) throw new Error('1D/shaper LUTs are not supported');
    if (key === 'LUT_3D_SIZE') { if(size) throw new Error('Duplicate LUT size'); size = Number(args[0]); if(args.length!==1 || !Number.isInteger(size) || size<2 || size>128) throw new Error('Invalid LUT size'); continue; }
    if (key === 'DOMAIN_MIN' || key === 'DOMAIN_MAX') { const v = args.map(Number); if(v.length!==3 || !v.every(Number.isFinite)) throw new Error('Invalid domain'); if(key==='DOMAIN_MIN') min=v as Cube['min']; else max=v as Cube['max']; continue; }
    const v=line.split(/\s+/).map(Number); if(v.length!==3 || !v.every(Number.isFinite)) throw new Error('Invalid LUT sample or unsupported directive'); values.push(...v);
  }
  if (!size || values.length!==size**3*3) throw new Error(`Expected ${size**3} samples; found ${values.length/3}`);
  if(min.some((v,i)=>v>=max[i])) throw new Error('Domain must have positive range');
  return {title,size,min,max,data:new Float32Array(values)};
}
export function sampleCube(cube: Cube, rgb: number[], strength=1): number[] {
  const p=rgb.map((v,i)=>Math.max(0,Math.min(1,(v-cube.min[i])/(cube.max[i]-cube.min[i])))*(cube.size-1));
  const lo=p.map(Math.floor), hi=p.map(v=>Math.min(cube.size-1,Math.ceil(v))), f=p.map((v,i)=>v-lo[i]);
  return rgb.map((v,c)=>{ let out=0; for(let b=0;b<2;b++)for(let g=0;g<2;g++)for(let r=0;r<2;r++) {const x=r?hi[0]:lo[0],y=g?hi[1]:lo[1],z=b?hi[2]:lo[2];out+=cube.data[(x+y*cube.size+z*cube.size**2)*3+c]*(r?f[0]:1-f[0])*(g?f[1]:1-f[1])*(b?f[2]:1-f[2]);}return Math.max(0,Math.min(1,v*(1-strength)+out*strength));});
}
export function cropDimensions(width:number,height:number,aspect:number){return width/height>aspect?{width:Math.round(height*aspect),height}:{width,height:Math.round(width/aspect)};}
