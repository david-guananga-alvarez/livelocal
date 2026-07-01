import React, { useEffect, useMemo, useState } from 'react';
import { Eye, User, MapPinned, Shield } from 'lucide-react';
import { loadState, saveState, storageKeyFor } from './state/store';
import ClientView from './modules/client/ClientView';
import LocalView from './modules/local/LocalView';
import AdminView from './modules/admin/AdminView';
import { LoginScreen, UserMenu, useAuth } from './modules/auth';
import './styles/app.css';

export default function App(){
 const { user, loading, isAuthenticated } = useAuth();
 const userId = user?.id || user?.email || 'anonymous';
 const stateKey = useMemo(() => storageKeyFor(userId), [userId]);
 const [state,setStateRaw]=useState(()=>loadState(userId));
 const [tab,setTab]=useState('client');

 useEffect(()=>{ if(isAuthenticated) setStateRaw(loadState(userId)); }, [isAuthenticated, userId]);

 function setState(next){
   setStateRaw(prev=>{
     const resolved = typeof next === 'function' ? next(prev) : next;
     saveState(resolved, userId);
     return resolved;
   });
 }

 useEffect(()=>{ if(isAuthenticated) saveState(state, userId); },[state, userId, isAuthenticated]);
 useEffect(()=>{
   const onStorage = (event)=>{
     if(event.key===stateKey && event.newValue){
       try { setStateRaw(JSON.parse(event.newValue)); } catch {}
     }
   };
   window.addEventListener('storage', onStorage);
   return ()=>window.removeEventListener('storage', onStorage);
 },[stateKey]);

 if(loading) return <main className="loadingScreen"><div className="spinner"></div><p>Cargando sesión...</p></main>;
 if(!isAuthenticated) return <LoginScreen/>;

 return <main><nav className="topbar"><div className="brand"><Eye/> <b>LiveLocal</b><span>Google Auth</span></div><div className="tabs"><button className={tab==='client'?'active':''} onClick={()=>setTab('client')}><User size={16}/> Cliente</button><button className={tab==='local'?'active':''} onClick={()=>setTab('local')}><MapPinned size={16}/> Local</button><button className={tab==='admin'?'active':''} onClick={()=>setTab('admin')}><Shield size={16}/> Admin</button></div><UserMenu/></nav>{tab==='client'&&<ClientView state={state} setState={setState}/>} {tab==='local'&&<LocalView state={state} setState={setState}/>} {tab==='admin'&&<AdminView state={state} setState={setState}/>}</main>;
}
