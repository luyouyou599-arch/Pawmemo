import {describe,it,expect} from 'vitest';
import {photoType,rasterType,avatarBytes,PHOTO_INPUT_LIMIT,PHOTO_AVATAR_LIMIT} from '../src/v3Photo';
const png=new Uint8Array([137,80,78,71,13,10,26,10]),jpeg=new Uint8Array([255,216,255,224]),webp=new TextEncoder().encode('RIFF0000WEBP');
describe('photo classification uses local bytes rather than optional MIME',()=>{
 it.each([[png,'image/png'],[jpeg,'image/jpeg'],[webp,'image/webp']] as const)('sniffs supported raster header',async(bytes,type)=>{expect(rasterType(bytes)).toBe(type);expect(await photoType(new File([bytes],'image.bin',{type:''}))).toBe(type)});
 it('does not accept SVG hidden behind a raster MIME',async()=>{await expect(photoType(new File(['<svg/>'],'photo.png',{type:'image/png'}))).rejects.toMatchObject({code:'format'})});
 it('separates empty, oversized, HEIF and unsupported input errors',async()=>{await expect(photoType(new File([],'empty.png'))).rejects.toMatchObject({code:'empty'});await expect(photoType(new File([new Uint8Array(PHOTO_INPUT_LIMIT+1)],'large.png'))).rejects.toMatchObject({code:'input_size'});await expect(photoType(new File(['0000ftypheic0000'],'photo.heic',{type:'image/heic'}))).rejects.toMatchObject({code:'heif'});await expect(photoType(new File(['other'],'other.gif',{type:'image/gif'}))).rejects.toMatchObject({code:'format'})});
 it('retains a bounded input cap and original persisted avatar byte cap',()=>{expect(PHOTO_INPUT_LIMIT).toBe(10*1024*1024);expect(PHOTO_AVATAR_LIMIT).toBe(2*1024*1024);expect(avatarBytes('data:image/png;base64,AQ==')).toBe(1);expect(avatarBytes('data:image/png;base64,AQI=')).toBe(2);expect(avatarBytes('data:image/png;base64,AQID')).toBe(3)});
});
