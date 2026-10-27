/** Capture PCM directly: avoids MediaRecorder codecs that are unavailable in Simulator. */
export function recordPCM(stream:MediaStream,context:AudioContext,onError:(message:string)=>void){
 const source=context.createMediaStreamSource(stream),processor=context.createScriptProcessor(4096,1,1),mute=context.createGain();
 mute.gain.value=0;const chunks:Float32Array[]=[];let frames=0,active=true;
 const disconnect=()=>{processor.onaudioprocess=null;source.disconnect();processor.disconnect();mute.disconnect();void context.close().catch(()=>{})};
 processor.onaudioprocess=e=>{if(!active)return;const samples=new Float32Array(e.inputBuffer.getChannelData(0));frames+=samples.length;if(frames/context.sampleRate>120){active=false;disconnect();onError('录音超过2分钟，请缩短后重试。');return}chunks.push(samples)};
 source.connect(processor);processor.connect(mute);mute.connect(context.destination);
 return {
  cancel(){if(!active)return;active=false;disconnect();chunks.length=0},
  async stop(expectedSeconds:number){if(!active)throw Error('录音已结束，请重新录音。');active=false;const sampleRate=context.sampleRate;disconnect();
   if(!frames)throw Error('没有录到声音，请重新录音。');
   const duration=frames/sampleRate;if(duration+Math.max(.75,expectedSeconds*.1)<expectedSeconds)throw Error('录音不完整，已暂停识别。请重新录音，原草稿仍保留。');
   const offline=new OfflineAudioContext(1,Math.max(1,Math.round(duration*16000)),16000),buffer=offline.createBuffer(1,frames,sampleRate);let offset=0;
   for(const chunk of chunks){buffer.getChannelData(0).set(chunk,offset);offset+=chunk.length}chunks.length=0;
   const input=offline.createBufferSource();input.buffer=buffer;input.connect(offline.destination);input.start();const rendered=await offline.startRendering();
   return pcmWav(rendered.getChannelData(0));
  }
 };
}
function pcmWav(samples:Float32Array){
 const bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes);
 const word=(at:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i))};
 word(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++){const value=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,value<0?value*32768:value*32767,true)}
 return new Blob([bytes],{type:'audio/wav'});
}

/** Reject digital silence before ASR can invent text from an empty signal. */
export async function validateRecording(blob:Blob){
 const bytes=await blob.arrayBuffer(),v=new DataView(bytes);
 if(bytes.byteLength<46)throw Error('没有录到声音，请重新录音。');
 for(let at=44;at+1<bytes.byteLength;at+=2)if(v.getInt16(at,true)!==0)return;
 throw Error('没有录到声音，请检查麦克风后重试。');
}
