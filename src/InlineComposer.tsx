import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Icon,IconButton} from './v3UI';
import {useVoiceRecording} from './useVoiceRecording';
export function InlineComposer({petId,text,onText,onSend,disabled,initialVoice=false,initialVoiceSource=false,onTranscribed}:{petId:string;text:string;onText:(text:string)=>void;onSend:(source:'text'|'voice')=>void;disabled:boolean;initialVoice?:boolean;initialVoiceSource?:boolean;onTranscribed?:()=>void}){
 const [voice,setVoice]=useState(initialVoice),area=useRef<HTMLTextAreaElement>(null),voiceUsed=useRef(initialVoiceSource);
 const recording=useVoiceRecording({petId,text,onText,onReady:()=>{voiceUsed.current=true;onTranscribed?.();setVoice(false);setTimeout(()=>area.current?.focus(),0)},disabled});
 const {phase,error,seconds,cancelled,busy,cancel}=recording;
 useLayoutEffect(()=>{const el=area.current;if(el){el.style.height='0px';el.style.height=Math.min(el.scrollHeight,104)+'px'}},[text,voice]);
 useEffect(()=>{if(!text)voiceUsed.current=false},[text]);
 useEffect(()=>{if(initialVoiceSource)area.current?.focus()},[]);
 const toggle=()=>{cancel();setVoice(v=>!v);if(voice)setTimeout(()=>area.current?.focus(),0)};
 return <form className={'composer inline-composer'+(voice?' voice-mode':'')} onSubmit={e=>{e.preventDefault();if(!busy&&!disabled&&text.trim())onSend(voiceUsed.current?'voice':'text')}}>
  {voice&&phase!=='idle'&&<div className="voice-feedback"><p role={phase==='error'?'alert':'status'}>{phase==='error'?error:phase==='requesting'?'正在连接麦克风…':phase==='preparing'?'正在启动麦克风…':phase==='recording'?`${seconds} 秒`:phase==='transcribing'?'正在转成文字…': ''}</p>{busy&&<button type="button" className="voice-alternative" onClick={cancel}>取消{phase==='transcribing'?'转写':'录音'}</button>}</div>}
  <IconButton icon={voice?'keyboard':'mic'} label={voice?'切换文字输入':'语音录入'} onClick={toggle}/>
  {voice?<div className="voice-controls"><button type="button" className="hold-record" aria-label="按住说话" data-phase={phase} data-cancelled={cancelled} disabled={disabled||phase==='transcribing'} {...recording.holdProps}>{phase==='recording'?(cancelled?'松开取消':'松开结束'):['requesting','preparing'].includes(phase)?'等待麦克风…':phase==='transcribing'?'正在转写…':'按住说话'}</button></div>:<textarea ref={area} className="composer-input" rows={1} aria-label="记一件事，或问个问题" placeholder="记一件事，或问个问题" maxLength={12000} value={text} onChange={e=>onText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent.isComposing&&e.nativeEvent.keyCode!==229){e.preventDefault();if(!disabled&&text.trim())onSend(voiceUsed.current?'voice':'text')}}}/>}
  <button type="submit" className="icon-button send" aria-label="发送" disabled={busy||disabled||!text.trim()}><Icon name="send"/></button>
 </form>
}
