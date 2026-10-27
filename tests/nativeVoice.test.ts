import {afterEach,describe,it,expect,vi} from 'vitest';
import {createNativeRecording} from '../src/nativeVoice';
import {validateRecording} from '../src/v3Audio';
function wave(value=0){const b=new Uint8Array(32044);new DataView(b.buffer).setInt16(44,value,true);return b}
function bridge(postMessage:(body:{action:string;id:string})=>Promise<object>){vi.stubGlobal('window',{webkit:{messageHandlers:{pawmemoAudio:{postMessage}}}})}
afterEach(()=>vi.unstubAllGlobals());
describe('native microphone adapter',()=>{
 it('ordinary browser uses Web Audio fallback',()=>{vi.stubGlobal('window',{});expect(createNativeRecording()).toBeNull()});
 it('isolates cancellation by recording id and returns WAV',async()=>{
  const calls:{action:string;id:string}[]=[];
  bridge(async body=>{calls.push(body);return body.action==='stop'?{base64:btoa(String.fromCharCode(...wave(1000)))}:{ready:true}});
  const a=createNativeRecording()!,b=createNativeRecording()!;await Promise.all([a.ready,b.ready]);a.cancel();
  expect(calls[0].id).not.toBe(calls[1].id);expect(calls[2]).toEqual({action:'cancel',id:calls[0].id});
  const wav=await b.stop(1);expect(wav.type).toBe('audio/wav');await expect(validateRecording(wav)).resolves.toBeUndefined();
  expect(calls[3]).toEqual({action:'stop',id:calls[1].id});
 });
 it('rejects truncated audio and permission failures',async()=>{
  bridge(async body=>body.action==='stop'?{base64:btoa(String.fromCharCode(...wave(1)))}:{ready:true});
  const a=createNativeRecording()!;await a.ready;await expect(a.stop(6)).rejects.toThrow('录音不完整');
  bridge(async()=>{throw '麦克风权限被拒绝'});
  await expect(createNativeRecording()!.ready).rejects.toThrow('麦克风权限被拒绝');
 });
 it('rejects exact digital silence but preserves a quiet signal',async()=>{
  await expect(validateRecording(new Blob([wave()]))).rejects.toThrow('没有录到声音');
  await expect(validateRecording(new Blob([wave(1)]))).resolves.toBeUndefined();
 });
});
