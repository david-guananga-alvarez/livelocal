import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, hasSupabaseConfig } from './supabaseClient';

const MOCK_KEY = 'livelocal-auth-mock-user';
const AuthContext = createContext(null);

function loadMockUser(){
  try { return JSON.parse(localStorage.getItem(MOCK_KEY)); } catch { return null; }
}

export function AuthProvider({ children }){
  const [user, setUser] = useState(() => hasSupabaseConfig ? null : loadMockUser());
  const [loading, setLoading] = useState(Boolean(hasSupabaseConfig));

  useEffect(() => {
    if(!hasSupabaseConfig || !supabase){ setLoading(false); return; }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  async function signInWithGoogle(){
    if(hasSupabaseConfig && supabase){
      const redirectTo = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if(error) throw error;
      return;
    }

    const mockUser = {
      id: 'demo-user-david',
      email: 'david.demo@gmail.com',
      user_metadata: {
        full_name: 'David Demo',
        avatar_url: '',
      },
      app_metadata: { provider: 'google-demo' },
    };
    localStorage.setItem(MOCK_KEY, JSON.stringify(mockUser));
    setUser(mockUser);
  }

  async function signOut(){
    if(hasSupabaseConfig && supabase){
      await supabase.auth.signOut();
      setUser(null);
      return;
    }
    localStorage.removeItem(MOCK_KEY);
    setUser(null);
  }

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    hasSupabaseConfig,
    signInWithGoogle,
    signOut,
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){
  const ctx = useContext(AuthContext);
  if(!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
