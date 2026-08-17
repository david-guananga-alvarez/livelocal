import React, { useEffect, useMemo, useState } from 'react';
import { UserCheck, Play, LocateFixed } from 'lucide-react';
import { zones } from '../../data/seed';
import { statusLabel } from '../matching/matching';
import { distanceKm, estimateEtaMinutes, formatDistance, getBrowserLocation } from '../location/location';
import SessionWorkspace from '../session/SessionWorkspace';
import {
  getRequests,
  acceptRequest
} from '../requests/requestsService';

import { supabase } from '../auth/supabaseClient';
import { useAuth } from '../auth/AuthProvider';

export default function LocalView({ state, setState }){
 const { user } = useAuth();
 const local = {
  id: user?.id,
  name: user?.user_metadata?.full_name || user?.email || 'Local',
  zones: state.locals[0]?.zones ?? [],
  rating: state.locals[0]?.rating ?? 5,
  location: state.locals[0]?.location ?? null,
};
 const [geoStatus, setGeoStatus] = useState('');

useEffect(() => {
  async function loadRequests() {
    try {
      const rows = await getRequests();

      const mappedRequests = rows.map(row => {
        const zoneData = zones.find(z => z.id === row.zone);

        return {
          id: row.id,
          clientId: row.client_id,
          localId: row.local_id,
          zoneId: row.zone,
          zoneName: zoneData?.name ?? row.zone,
          zoneCenter: zoneData?.center ?? null,
          duration: row.duration_minutes,
          price: row.duration_minutes === 15 ? 15 : row.duration_minutes === 30 ? 25 : 35,
          notes: row.description,
          status: row.status,
          createdAt: row.created_at,
          candidateLocalIds: [],
          bestEta: zoneData?.eta ?? null,
          bestDistanceKm: null,
        };
      });

      setState(prev => ({
        ...prev,
        requests: mappedRequests,
      }));
    } catch (error) {
      console.error('Error cargando peticiones desde Supabase:', error);
    }
  }

  loadRequests();
}, []);

useEffect(() => {
  const channel = supabase
    .channel('requests-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'requests',
      },
      payload => {
        console.log('Cambio realtime en requests:', payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

 const enrichedRequests = useMemo(()=>state.requests.map(r=>{
   const km = distanceKm(local.location, r.zoneCenter || zones.find(z=>z.id===r.zoneId)?.center);
   return {...r, distanceKm: km, etaMinutes: estimateEtaMinutes(km)};
 }), [state.requests, local.location]);
 const incoming = enrichedRequests.filter(
  r =>
    r.status === 'pending' &&
    r.clientId &&
    r.clientId !== user?.id &&
    (local.zones.includes(r.zoneId) || r.distanceKm <= 3)
);
 const mine=enrichedRequests.find(r=>r.localId===local.id && r.status!=='completed'&&r.status!=='cancelled');
 async function accept(req) {
  try {
    await acceptRequest(req.id, local.id);

    setState(prev => ({
      ...prev,
      requests: prev.requests.map(r =>
        r.id === req.id
          ? {
              ...r,
              status: 'matched',
              localId: local.id,
              acceptedAt: new Date().toLocaleString(),
            }
          : r
      ),
    }));
  } catch (error) {
    console.error('Error aceptando petición:', error);
    alert('No se pudo aceptar la petición');
  }
}
 function start(){ setState({...state, requests:state.requests.map(r=>r.id===mine.id?{...r,status:'in_progress'}:r)}); }
 async function updateLocation(){
   setGeoStatus('Pidiendo permiso de ubicación...');
   try {
     const location = await getBrowserLocation();
     setState({...state, locals: state.locals.map(l=>l.id===local.id?{...l, location}:l)});
     setGeoStatus(`Ubicación actualizada · precisión ${location.accuracy} m`);
   } catch (error) {
     setGeoStatus(error?.message || 'No se pudo obtener la ubicación');
   }
 }
 if(mine){ return <div className="stack"><section className="hero compact"><p className="eyebrow">Local</p><h1>{statusLabel(mine.status)}</h1><p>{mine.zoneName} · {mine.duration} min · {mine.price} € · {formatDistance(mine.distanceKm)}</p>{mine.status==='matched'&&<button onClick={start}><Play size={16}/> Entrar en sesión</button>}</section>{mine.status==='in_progress'&&<SessionWorkspace request={mine} state={state} setState={setState} role="Local"/>}</div> }
 return <div className="stack"><section className="hero compact"><p className="eyebrow">Local conectado</p><h1>{local.name}</h1><p>Zonas: {local.zones.join(', ')} · ⭐ {local.rating}</p><div className="geoActions"><button onClick={updateLocation}><LocateFixed size={16}/> Usar mi ubicación actual</button>{geoStatus&&<small>{geoStatus}</small>}{local.location&&<small>Lat {local.location.lat.toFixed(4)}, Lng {local.location.lng.toFixed(4)}</small>}</div></section><section className="card"><h2>Solicitudes entrantes</h2>{incoming.length===0?<p className="muted">No hay solicitudes compatibles ahora. Crea una desde Cliente o actualiza tu ubicación.</p>:incoming.map(r=><div className="requestCard" key={r.id}><div><b>{r.zoneName}</b><span>{r.duration} min · {r.price} € · {formatDistance(r.distanceKm)} · {r.etaMinutes ?? '—'} min</span><small>{r.notes}</small></div><button onClick={()=>accept(r)}><UserCheck size={16}/> Aceptar</button></div>)}</section></div>
}
