import {Button} from './v3UI';
import {useVoiceRecording} from './useVoiceRecording';
/** Remain on home until capture and ASR finish, then open the same pet's draft. */
export function HomeVoiceFooter({petId,text,onText,onReady,onChat,disabled}:{petId:string;text:string;onText:(text:string)=>void;onReady:()=>void;onChat:()=>void;disabled:boolean}){
 const recording=useVoiceRecording({petId,text,onText,onReady,disabled}),{phase,error,seconds,cancelled,busy,cancel}=recording;
 const status=phase==='error'?error:phase==='requesting'?'正在连接麦克风…':phase==='preparing'?'正在启动麦克风…':phase==='recording'?`${seconds} 秒`:phase==='transcribing'?'正在转成文字…':'';
 return <>{phase!=='idle'&&<div className="home-voice-feedback" id="home-voice-status"><p role={phase==='error'?'alert':'status'}>{status}</p><div>{['requesting','preparing','transcribing'].includes(phase)?<button className="voice-alternative" type="button" onClick={cancel}>{phase==='transcribing'?'取消转写':'取消录音'}</button>:null}{phase==='recording'&&<button className="voice-alternative" type="button" onClick={cancel}>取消录音</button>}</div></div>}<Button icon="chat" onClick={onChat}>进入对话</Button><Button icon={phase==='recording'?'stop':'mic'} className="home-hold-record" tone="primary" aria-label="语音说说" aria-describedby={phase!=='idle'?'home-voice-status':undefined} data-phase={phase} data-cancelled={cancelled} disabled={disabled||phase==='transcribing'} {...recording.holdProps}>{phase==='recording'?(cancelled?'松开取消':'松开结束'):['requesting','preparing'].includes(phase)?'等待麦克风…':busy?'正在转写…':'语音说说'}</Button></>
}
