import React, { useMemo, useState } from 'react';
import { Search, Video, CheckCircle, MapPin } from 'lucide-react';
import { zones, prices } from '../../data/seed';
import { uid } from '../../state/store';
import { getMatchingLocals, statusLabel } from '../matching/matching';
import { formatDistance } from '../location/location';
import ZoneMap from '../../components/ZoneMap';
import SessionWorkspace from '../session/SessionWorkspace';

export default function ClientView({ state, setState }){
 const [zone,setZone]=useState('gothic');
 const [duration,setDuration]=useState(15);
 const [notes,setNotes]=useState('Enséñame la zona en directo y responde dudas.');
 const active=[...state.requests].reverse().find(r=>r.status!=='completed'&&r.status!=='cancelled');
 const selectedZone = zones.find(z=>z.id===zone);
 const matches = useMemo(()=>getMatchingLocals(state.locals, zone, zones), [state.locals, zone]);

 function requestNow(){
   const best = matches[0];
   const req={
     id:uid('req'), zoneId:zone, zoneName:selectedZone.name, zoneCenter:selectedZone.center,
     duration, price:prices[duration], notes, status:'pending', createdAt:new Date().toLocaleString(),
     localId:null, candidateLocalIds:matches.map(m=>m.id), bestEta:best?.etaMinutes ?? selectedZone.eta,
     bestDistanceKm:best?.distanceKm ?? null
   };
   setState({...state, requests:[...state.requests, req]});
 }
 function startSession(){ setState({...state, requests:state.requests.map(r=>r.id===active.id?{...r,status:'in_progress'}:r)}); }
 function complete(){ setState({...state, requests:state.requests.map(r=>r.id===active.id?{...r,status:'completed'}:r)}); }
 if(active){
   const local=state.locals.find(l=>l.id===active.localId);
   return <div className="stack"><section className="hero compact"><p className="eyebrow">Cliente</p><h1>{statusLabel(active.status)}</h1><p>{active.zoneName} · {active.duration} min · {active.price} €</p>{active.status==='pending'&&<div className="searching"><span></span> Buscando local cercano... ETA estimada {active.bestEta ?? '—'} min</div>}{active.status==='matched'&&<div className="matched"><CheckCircle/> Local encontrado: <b>{local?.name}</b>{local?.distanceKm!=null&&<small>{formatDistance(local.distanceKm)} · {local.etaMinutes} min aprox.</small>}<button onClick={startSession}><Video size={16}/> Iniciar sesión</button></div>}{active.status==='in_progress'&&<button className="success" onClick={complete}>Finalizar servicio</button>}</section>{active.status==='in_progress'&&<SessionWorkspace request={active} state={state} setState={setState} role="Cliente"/>}</div>
 }
 return <div className="stack"><section className="hero"><p className="eyebrow">LiveLocal Barcelona</p><h1>Pide ojos humanos en una zona, como pedir un Uber.</h1><p>Ahora el matching usa zonas + distancia aproximada de los locales disponibles.</p></section><section className="card"><h2>¿Dónde necesitas un local?</h2><ZoneMap zones={zones} selected={zone} onSelect={setZone}/><div className="coverageBox"><MapPin size={18}/><div><b>{selectedZone.name}</b><span>{matches.length} locales compatibles · ETA {matches[0]?.etaMinutes ?? selectedZone.eta} min</span>{matches[0]&&<small>Más cercano: {matches[0].name}, {formatDistance(matches[0].distanceKm)}</small>}</div></div><div className="formRow"><label>Duración<select value={duration} onChange={e=>setDuration(+e.target.value)}><option value="15">15 min · 15 €</option><option value="30">30 min · 25 €</option><option value="45">45 min · 35 €</option></select></label><label>Instrucciones<textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label></div><button className="primary big" onClick={requestNow}><Search size={18}/> Pedir local ahora</button></section></div>
}
