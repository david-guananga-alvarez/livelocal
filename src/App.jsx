import React, { useEffect, useMemo, useState } from 'react';
import { loadState, saveState, storageKeyFor } from './state/store';
import AppShell from './components/AppShell';
import AppStateScreen from './components/AppStateScreen';
import useNetworkStatus from './hooks/useNetworkStatus';
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
 const isOnline = useNetworkStatus();

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

 if(loading) return <AppStateScreen title="Cargando tu sesión" message="Estamos preparando LiveLocal de forma segura."/>;
 if(!isAuthenticated) return <LoginScreen/>;
 if(profileLoading) return <AppStateScreen title="Preparando tu experiencia" message="Estamos recuperando tu perfil y preferencias."/>;
 if(hasSupabaseConfig && profileError) return <AppStateScreen type="error" title="No hemos podido abrir tu perfil" message={profileError} primaryAction={{ label: 'Reintentar', onClick: reloadProfile }} secondaryAction={{ label: 'Cerrar sesión', onClick: signOut }}/>;

 return (
   <AppShell activeRole={activeRole} canAccessAdmin={canAccessAdmin} onRoleChange={setTab} userMenu={<UserMenu/>} isOnline={isOnline}>
     {activeRole==='client'&&<ClientView state={state} setState={setState}/>} {activeRole==='local'&&<LocalView state={state} setState={setState}/>} {activeRole==='admin'&&<AdminView state={state} setState={setState}/>}
   </AppShell>
 );
}
