import {useEffect,useRef,useState,type ButtonHTMLAttributes} from 'react';
import {recordPCM,validateRecording} from './v3Audio';
import {createNativeRecording,type VoiceCapture} from './nativeVoice';
import {transcribe} from './v3Api';
type Phase='idle'|'requesting'|'preparing'|'recording'|'transcribing'|'error';
/** One recorder/ASR implementation shared by home and chat; caller owns a keyed pet session. */
export function useVoiceRecording({petId,text,onText,onReady,disabled}:{petId:string;text:string;onText:(text:string)=>void;onReady?:()=>void;disabled:boolean}){
 const [phase,setPhase]=useState<Phase>('idle'),[error,setError]=useState(''),[seconds,setSeconds]=useState(0),[cancelled,setCancelled]=useState(false);
 const latest=useRef({text,onText,onReady}),phaseRef=useRef<Phase>('idle'),generation=useRef(0),recorder=useRef<VoiceCapture|null>(null),audio=useRef<AudioContext|null>(null),stream=useRef<MediaStream|null>(null),abort=useRef<AbortController|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),limit=useRef<ReturnType<typeof setTimeout>|null>(null),captureStart=useRef(0),captureStop=useRef(0),pointer=useRef<number|null>(null),cancelRef=useRef(false),mounted=useRef(true);
 latest.current={text,onText,onReady};
 const changePhase=(next:Phase)=>{phaseRef.current=next;setPhase(next)};
 function clearTimers(){if(timer.current)clearInterval(timer.current);if(limit.current)clearTimeout(limit.current);timer.current=null;limit.current=null}
 function cleanup(){generation.current++;pointer.current=null;abort.current?.abort();abort.current=null;clearTimers();const r=recorder.current;recorder.current=null;r?.cancel();const ctx=audio.current;audio.current=null;if(ctx)void ctx.close().catch(()=>{});stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;captureStart.current=0;captureStop.current=0}
 function cancel(){cleanup();changePhase('idle');setCancelled(false);cancelRef.current=false;setError('');}
 function fail(message:string){cleanup();if(!mounted.current)return;setError(message);changePhase('error');setCancelled(false)}
 useEffect(()=>{mounted.current=true;const blur=()=>{if(['requesting','preparing','recording','transcribing'].includes(phaseRef.current))cancel()};const hidden=()=>{if(document.hidden)blur()};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);return()=>{mounted.current=false;cleanup();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden)}},[]);
 async function convert(blob:Blob,token:number){const c=new AbortController();abort.current=c;try{const wav=blob;if(token!==generation.current)return;await validateRecording(wav);if(token!==generation.current)return;if(wav.size>10*1024*1024)throw Error('录音超过10MB，请缩短后重试。');const result=await transcribe(wav,petId,c.signal);if(token!==generation.current||!mounted.current)return;const existing=latest.current.text,merged=existing?existing+'\n'+result:result;if(merged.length>12000)throw Error('草稿加转写超过12000字，请缩短草稿后重新录音。');latest.current.onText(merged);changePhase('idle');latest.current.onReady?.()}catch(e){if(token===generation.current)fail((e as Error).message)}}
 function stop(){clearTimers();if(['requesting','preparing'].includes(phaseRef.current)){cancel();return}const r=recorder.current;if(!r||phaseRef.current!=='recording')return;recorder.current=null;captureStop.current=performance.now();changePhase('transcribing');const token=generation.current,expectedSeconds=(captureStop.current-captureStart.current)/1000;
 stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
 void r.stop(expectedSeconds).then(blob=>{if(token===generation.current){audio.current=null;void convert(blob,token)}}).catch(e=>{if(token===generation.current)fail((e as Error).message)});
 }
 async function start(){if(disabled||['requesting','preparing','recording','transcribing'].includes(phaseRef.current))return;cleanup();const token=generation.current;setError('');setSeconds(0);setCancelled(false);cancelRef.current=false;changePhase('requesting');
 try{const native=createNativeRecording();if(native){recorder.current=native;await native.ready;if(token!==generation.current||!mounted.current){native.cancel();return}}else{if(!navigator.mediaDevices?.getUserMedia||!window.AudioContext)throw Error('当前浏览器无法录音，请改用文字。');
 const ctx=new AudioContext();audio.current=ctx;void ctx.resume().catch(()=>{});
 const s=await navigator.mediaDevices.getUserMedia({audio:true});if(token!==generation.current||!mounted.current){s.getTracks().forEach(t=>t.stop());void ctx.close().catch(()=>{});return}stream.current=s;changePhase('preparing');
 limit.current=setTimeout(()=>{if(token===generation.current)fail('麦克风未能开始收音，请重试或改用文字。')},10000);
 await ctx.resume();if(token!==generation.current||!mounted.current)return;
 recorder.current=recordPCM(s,ctx,message=>{if(token===generation.current)fail(message)});}
 clearTimers();captureStart.current=performance.now();changePhase('recording');
 timer.current=setInterval(()=>setSeconds(Math.floor((performance.now()-captureStart.current)/1000)),1000);limit.current=setTimeout(stop,119000);
 }catch(e){if(token!==generation.current)return;fail((e as DOMException).name==='NotAllowedError'?'无法使用麦克风，请在浏览器允许录音，或改用文字。':(e as Error).message)}}

 const busy=['requesting','preparing','recording','transcribing'].includes(phase);
 const holdProps:ButtonHTMLAttributes<HTMLButtonElement>={
  onPointerDown:e=>{if(e.button!==0||disabled||busy)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);void start();pointer.current=e.pointerId},
  onPointerMove:e=>{if(pointer.current!==e.pointerId)return;const b=e.currentTarget.getBoundingClientRect(),outside=e.clientY<b.top-24||e.clientX<b.left||e.clientX>b.right||e.clientY>b.bottom+24;cancelRef.current=outside;setCancelled(outside)},
  onPointerUp:e=>{if(pointer.current!==e.pointerId)return;pointer.current=null;if(cancelRef.current)cancel();else stop()},
  onPointerCancel:()=>cancel(),onLostPointerCapture:()=>{if(pointer.current!==null)cancel()},
  onKeyDown:e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();if(phaseRef.current==='recording')stop();else void start()}if(e.key==='Escape')cancel()},
  onClick:e=>{if(e.detail===0){if(phaseRef.current==='recording')stop();else void start()}},
  onContextMenu:e=>e.preventDefault()
 };
 return {phase,error,seconds,cancelled,busy,start,stop,cancel,holdProps};
}
