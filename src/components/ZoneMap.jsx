import React from 'react';
import { MapPin } from 'lucide-react';
export default function ZoneMap({ zones, selected, onSelect }){ return <div className="mapGrid">{zones.map(z=><button key={z.id} onClick={()=>onSelect(z.id)} className={`zone ${selected===z.id?'selected':''}`}><MapPin size={18}/><b>{z.name}</b><span>{z.coverage} cobertura</span><small>{z.eta} min · {z.locals} locales</small></button>)}</div> }
