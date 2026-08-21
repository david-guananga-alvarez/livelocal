import React, { useEffect, useMemo, useState } from 'react';
import { Eye, User, MapPinned, Shield } from 'lucide-react';
import { loadState, saveState, storageKeyFor } from './state/store';
import ClientView from './modules/client/ClientView';
import LocalView from './modules/local/LocalView';
import AdminView from './modules/admin/AdminView';
import { LoginScreen, UserMenu, useAuth } from './modules/auth';
import './styles/app.css';

export default function App(){
 const { user, loading, isAuthenticated, hasSupabaseConfig, role, profileLoading, profileError, reloadProfile, signOut } = useAuth();
 const userId = user?.id || user?.email || 'anonymous';
 const stateKey = useMemo(() => storageKeyFor(userId), [userId]);
 const [state,setStateRaw]=useState(()=>loadState(userId));
 const [tab,setTab]=useState('client');
 const activeRole = tab;
 const canAccessAdmin = !hasSupabaseConfig || role === 'admin';

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

 useEffect(()=>{
   if(tab === 'admin' && !canAccessAdmin) setTab('client');
 }, [tab, canAccessAdmin]);

 if(loading) return <main className="loadingScreen"><div className="spinner"></div><p>Cargando sesión...</p></main>;
 if(!isAuthenticated) return <LoginScreen/>;
 if(profileLoading) return <main className="loadingScreen"><div className="spinner"></div><p>Preparando tu experiencia...</p></main>;
 if(hasSupabaseConfig && profileError) return <main className="loadingScreen profileError"><h1>No hemos podido abrir tu perfil</h1><p>{profileError}</p><div className="dialogActions"><button onClick={()=>reloadProfile()}>Reintentar</button><button className="secondary" onClick={signOut}>Cerrar sesión</button></div></main>;

 return <main className="appShell">
   <nav className="topbar" aria-label="Navegación principal">
     <div className="brand"><span className="brandMark"><Eye size={19}/></span><b>LiveLocal</b><span className="brandCity">Barcelona</span></div>
     <div className="tabs" role="tablist" aria-label="Modo de uso">
       <button role="tab" aria-selected={tab==='client'} className={tab==='client'?'active':''} onClick={()=>setTab('client')}><User size={16}/> Cliente</button>
       <button role="tab" aria-selected={tab==='local'} className={tab==='local'?'active':''} onClick={()=>setTab('local')}><MapPinned size={16}/> Local</button>
       {canAccessAdmin && <button role="tab" aria-selected={tab==='admin'} className={tab==='admin'?'active':''} onClick={()=>setTab('admin')}><Shield size={16}/> Admin</button>}
     </div>
     <UserMenu/>
   </nav>
   <div className="appContent">{activeRole==='client'&&<ClientView state={state} setState={setState}/>} {activeRole==='local'&&<LocalView state={state} setState={setState}/>} {activeRole==='admin'&&<AdminView state={state} setState={setState}/>}</div>
 </main>;
}
