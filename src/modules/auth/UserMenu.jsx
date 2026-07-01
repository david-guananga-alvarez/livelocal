import React from 'react';
import { LogOut, UserCircle } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function UserMenu(){
  const { user, signOut } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email || 'Usuario';
  const avatar = user?.user_metadata?.avatar_url;
  return <div className="userMenu">
    {avatar ? <img src={avatar} alt={name}/> : <UserCircle size={22}/>}<span>{name}</span>
    <button onClick={signOut} title="Cerrar sesión"><LogOut size={15}/></button>
  </div>;
}
