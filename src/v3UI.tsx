import type {ReactNode,ButtonHTMLAttributes} from 'react';
import {Icon,type IconName} from './v3Icons';
export {Icon};
export function Button({children,icon='plus',tone='secondary',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{icon?:IconName;tone?:'primary'|'secondary'|'quiet'|'danger';children:ReactNode}){return <button type="button" {...props} className={`v3-button ${tone} ${className}`}><Icon name={icon}/><span>{children}</span></button>}
export function IconButton({icon,label,onClick,children}:{icon:IconName;label:string;onClick:()=>void;children?:ReactNode}){return <button type="button" className="icon-button" aria-label={label} onClick={onClick}><Icon name={icon}/>{children}</button>}
export function Heading({children,subtitle,lime=false}:{children:ReactNode;subtitle?:ReactNode;lime?:boolean}){return <section className={'emphasis '+(lime?'lime':'')}><h1 tabIndex={-1}>{children}</h1>{!lime&&<i className="highlighter"/>}{subtitle&&<p>{subtitle}</p>}<Icon name="spark" size={lime?32:24} className="heading-spark"/></section>}
export function Card({title,icon='memory',children,tint=false,owner=false,question=false}:{title:string;icon?:IconName;children?:ReactNode;tint?:boolean;owner?:boolean;question?:boolean}){return <section className={'message-card '+(tint?'tint ':'')+(owner?'owner ':'')+(question?'question':'')}><h2><Icon name={icon}/><span>{title}</span></h2>{children&&<div className="card-content">{children}</div>}</section>}
export function Avatar({src,name,size=72}:{src:string|null;name:string;size?:number}){return <div className="avatar" style={{width:size,height:size}}>{src?<img src={src} alt={name+'的照片'}/>:<Icon name="paw" size={size>100?48:24}/>}</div>}
export function Tags({tags}:{tags:string[]}){return <div className="tags">{tags.map(t=><span className="tag" key={t}><Icon name="tag" size={16}/>{t}</span>)}</div>}

export function ChatBubble({children,owner=false}:{children:ReactNode;owner?:boolean}){return <section className={'chat-bubble'+(owner?' owner':'')} aria-label={owner?'我的消息':'助手回复'}><div className="chat-text">{children}</div></section>}
