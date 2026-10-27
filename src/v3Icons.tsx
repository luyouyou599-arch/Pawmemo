export const iconFiles={
  "chat": "chat-bubble.svg",
  "switch": "switch-pets.svg",
  "wave": "6c717.svg",
  "withdraw": "10f91.svg",
  "alert": "ce57a.svg",
  "spark": "ca2d4.svg",
  "close": "a3837.svg",
  "source": "a012e.svg",
  "send": "836a7.svg",
  "back": "8f383.svg",
  "plus": "33de1.svg",
  "keyboard": "0ebb6.svg",
  "camera": "4fde0.svg",
  "check": "08bfe.svg",
  "paw": "a861b.svg",
  "undo": "2e3b0.svg",
  "stop": "147f2.svg",
  "mic": "33fd1.svg",
  "edit": "5804f.svg",
  "retry": "23fa7.svg",
  "tag": "d0ac7.svg",
  "memory": "c2d39.svg",
  "question": "b9a1f.svg"
} as const;
export type IconName=keyof typeof iconFiles;
export function Icon({name,size=24,className=""}:{name:IconName;size?:number;className?:string}) {return <span aria-hidden="true" className={"v3-icon "+className} style={{width:size,height:size}}><span className="icon-native" style={{transform:`scale(${size/(name==='spark'?32:24)})`}}><img alt="" src={"/v3/"+iconFiles[name]}/></span></span>}
