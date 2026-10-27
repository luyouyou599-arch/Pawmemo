/** iOS uses the system recorder; ordinary browsers retain Web Audio capture. */
type AudioBridge={postMessage:(body:{action:'start'|'stop'|'cancel';id:string})=>Promise<{ready?:boolean;base64?:string}>};
export type VoiceCapture={cancel:()=>void;stop:(expectedSeconds:number)=>Promise<Blob>};
export function createNativeRecording() {
 const bridge=(window as unknown as {webkit?:{messageHandlers?:{pawmemoAudio?:AudioBridge}}}).webkit?.messageHandlers?.pawmemoAudio;
 if(!bridge)return null;
 const id=crypto.randomUUID();let active=true;
 const request=(action:'start'|'stop'|'cancel')=>bridge.postMessage({action,id}).catch((error:unknown)=>{throw Error(error instanceof Error?error.message:String(error))});
 const ready=request('start').then(result=>{if(!result.ready)throw Error('麦克风未能开始收音，请重新录音。')});
 return {
  ready,
  cancel(){if(!active)return;active=false;void request('cancel').catch(()=>{})},
  async stop(expectedSeconds:number){
   if(!active)throw Error('录音已结束，请重新录音。');
   active=false;const result=await request('stop');
   if(!result.base64)throw Error('录音为空，请重新录音。');
   const raw=atob(result.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
   if(bytes.length<44||bytes.length>44+120*32000)throw Error('录音格式无法读取，请重新录音。');
   const duration=(bytes.length-44)/32000;
   if(duration+Math.max(.75,expectedSeconds*.1)<expectedSeconds)throw Error('录音不完整，已暂停识别。请重新录音，原草稿仍保留。');
   return new Blob([bytes],{type:'audio/wav'});
  }
 };
}
