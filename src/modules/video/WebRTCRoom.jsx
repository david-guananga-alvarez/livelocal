import React, { useEffect, useRef, useState } from 'react';
import { Camera, Mic, PhoneOff } from 'lucide-react';

const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function WebRTCRoom({ roomId, role }){
  const localVideo = useRef(null); const remoteVideo = useRef(null); const pcRef = useRef(null); const channelRef = useRef(null);
  const [started,setStarted]=useState(false); const [error,setError]=useState(''); const [status,setStatus]=useState('Sala interna lista');

  useEffect(()=>()=>stopCall(),[]);

  async function startCall(){
    try{
      setError(''); setStatus('Pidiendo cámara y micrófono...');
      const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
      localVideo.current.srcObject = stream;
      const pc = new RTCPeerConnection({ iceServers }); pcRef.current = pc;
      stream.getTracks().forEach(t=>pc.addTrack(t, stream));
      pc.ontrack = ev => { remoteVideo.current.srcObject = ev.streams[0]; setStatus('Conectado con la otra persona'); };
      pc.onicecandidate = ev => { if(ev.candidate) send({ type:'ice', candidate: ev.candidate }); };
      const channel = new BroadcastChannel(`livelocal-room-${roomId}`); channelRef.current = channel;
      channel.onmessage = async ({data}) => {
        if(!data || data.from===role) return;
        if(data.type==='offer'){
          setStatus('Oferta recibida. Conectando...');
          await pc.setRemoteDescription(data.offer);
          const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
          send({ type:'answer', answer });
        }
        if(data.type==='answer'){
          setStatus('Respuesta recibida. Estableciendo conexión...');
          await pc.setRemoteDescription(data.answer);
        }
        if(data.type==='ice'){
          try { await pc.addIceCandidate(data.candidate); } catch {}
        }
      };
      setStarted(true);
      if(role==='Cliente'){
        setStatus('Creando sala interna... abre otra pestaña como Local y acepta la misma sesión.');
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer); send({ type:'offer', offer });
      } else {
        setStatus('Esperando señal interna del cliente...');
      }
    }catch(e){ setError('No se pudo acceder a cámara/micrófono. Revisa permisos del navegador.'); console.error(e); }
  }
  function send(payload){ channelRef.current?.postMessage({ ...payload, from: role }); }
  function stopCall(){
    pcRef.current?.close(); channelRef.current?.close();
    [localVideo.current, remoteVideo.current].forEach(v=>{ if(v?.srcObject) v.srcObject.getTracks().forEach(t=>t.stop()); });
    pcRef.current=null; channelRef.current=null; setStarted(false); setStatus('Sala interna detenida');
  }
  return <section className="card videoRoom"><div className="sectionHeader"><div><h3>Videollamada interna</h3><p className="muted">WebRTC propio dentro de LiveLocal. Sin Jitsi, Meet ni redirecciones externas.</p></div>{started?<button className="danger" onClick={stopCall}><PhoneOff size={16}/> Colgar</button>:<button onClick={startCall}><Camera size={16}/> Entrar a la sala</button>}</div><div className="videoGrid"><div><video ref={localVideo} autoPlay muted playsInline/><span>Tú ({role})</span></div><div><video ref={remoteVideo} autoPlay playsInline/><span>Otra persona</span></div></div><p className="statusLine"><Mic size={14}/> {status}</p>{error&&<p className="error">{error}</p>}<p className="hint">MVP local: para probar dos usuarios, abre la app en dos pestañas del mismo navegador: una como Cliente y otra como Local. En producción, esta señalización se sustituye por Supabase Realtime/WebSocket.</p></section>
}
