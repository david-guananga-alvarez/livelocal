import React, { useState } from 'react';
import { Send } from 'lucide-react';
export default function ChatPanel({ requestId, state, setState, sender }){
 const [text,setText]=useState(''); const msgs=state.messages[requestId]||[];
 function send(){ if(!text.trim()) return; const msg={ id: crypto.randomUUID(), sender, text:text.trim(), at:new Date().toLocaleTimeString()};
 const next={...state, messages:{...state.messages,[requestId]:[...msgs,msg]}}; setState(next); setText(''); }
 return <section className="card chat"><h3>Chat de sesión</h3><div className="chatBox">{msgs.length===0&&<p className="muted">Aún no hay mensajes.</p>}{msgs.map(m=><div key={m.id} className={`bubble ${m.sender===sender?'me':''}`}><b>{m.sender}</b><span>{m.text}</span><small>{m.at}</small></div>)}</div><div className="chatInput"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Escribe un mensaje..."/><button onClick={send}><Send size={16}/> Enviar</button></div></section>
}
