// Decode only bounded local raster files; persisted avatars retain the original 2 MiB cap.
export const PHOTO_INPUT_LIMIT=10*1024*1024,PHOTO_AVATAR_LIMIT=2*1024*1024;
const MAX_PIXELS=24_000_000,MAX_EDGE=16384,AVATAR_EDGE=1024;
export class PhotoError extends Error {constructor(public code:string,message:string){super(message)}}
export function rasterType(bytes:Uint8Array):'image/png'|'image/jpeg'|'image/webp'|null{
 if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 const ascii=(start:number,length:number)=>String.fromCharCode(...bytes.slice(start,start+length));
 if(ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP')return 'image/webp';return null;
}
export function avatarBytes(data:string){const i=data.indexOf(',');if(i<0)return Infinity;const b=data.slice(i+1);return b.length*3/4-(b.endsWith('==')?2:b.endsWith('=')?1:0)}
export async function photoType(file:File){
 if(!file.size)throw new PhotoError('empty','这张照片是空文件，请重新选择。');
 if(file.size>PHOTO_INPUT_LIMIT)throw new PhotoError('input_size','原照片超过 10MB，请选择较小的图片。');
 let bytes:Uint8Array;try{bytes=new Uint8Array(await file.slice(0,40).arrayBuffer())}catch{throw new PhotoError('read','照片文件读取失败，请重新选择。')}
 const type=rasterType(bytes);if(type)return type;
 const header=String.fromCharCode(...bytes),heif=/^image\/hei[cf]/i.test(file.type)||/\.hei[cf]$/i.test(file.name)||(header.slice(4,8)==='ftyp'&&/heic|heix|hevc|hevx|heim|heis|mif1|msf1/.test(header.slice(8)));
 if(heif)throw new PhotoError('heif','暂不支持 HEIC/HEIF，请先导出为 JPEG 或 PNG。');
 throw new PhotoError('format','暂不支持这种图片格式，请选择 PNG、JPEG 或 WebP。');
}
function readImage(blob:Blob){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=reader.onabort=()=>reject(new PhotoError('read','照片文件读取失败，请重新选择。'));reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new PhotoError('read','照片文件读取失败，请重新选择。'));try{reader.readAsDataURL(blob)}catch{reject(new PhotoError('read','照片文件读取失败，请重新选择。'))}})}
export async function prepareAvatar(file:File,isCurrent=()=>true):Promise<string|null>{
 const type=await photoType(file);if(!isCurrent())return null;
 const src=await readImage(new Blob([file],{type}));if(!isCurrent())return null;
 const image=new Image();image.src=src;
 try{await image.decode()}catch{throw new PhotoError('decode','这张图片无法解码，可能已损坏或内容与格式不符。')}
 if(!isCurrent())return null;
 const width=image.naturalWidth,height=image.naturalHeight;
 if(!width||!height)throw new PhotoError('decode','这张图片没有可读取的画面，请重新选择。');
 if(width*height>MAX_PIXELS||Math.max(width,height)>MAX_EDGE)throw new PhotoError('dimensions','图片尺寸过大，请先缩小后再选。');
 if(file.size<=PHOTO_AVATAR_LIMIT&&Math.max(width,height)<=AVATAR_EDGE)return src;
 const canvas=document.createElement('canvas'),scale=Math.min(1,AVATAR_EDGE/Math.max(width,height));canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
 try{const context=canvas.getContext('2d');if(!context)throw Error();context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const result=canvas.toDataURL('image/jpeg',.85);if(!/^data:image\/jpeg;base64,/.test(result))throw Error();
  if(avatarBytes(result)>PHOTO_AVATAR_LIMIT||result.length>2800000)throw new PhotoError('output_size','照片压缩后仍超过 2MB，请选择较小的图片。');
  return isCurrent()?result:null;
 }catch(error){if(error instanceof PhotoError)throw error;throw new PhotoError('encode','照片缩小处理未完成，请换一张照片。')}
 finally{canvas.width=canvas.height=0}
}
