export type Photo={id:string;blob:Blob;created:number;look:string;width:number;height:number};
function db():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('camlut',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const database=await db();return new Promise((resolve,reject)=>{const t=database.transaction('photos',mode);const request=run(t.objectStore('photos'));t.oncomplete=()=>{database.close();resolve(request.result);};t.onerror=t.onabort=()=>{database.close();reject(t.error||request.error||new Error('Local storage unavailable'));};});}
export const getPhotos=()=>transaction('readonly',s=>s.getAll()) as Promise<Photo[]>;
export const savePhoto=(p:Photo)=>transaction('readwrite',s=>s.put(p));
export const deletePhoto=(id:string)=>transaction('readwrite',s=>s.delete(id));
