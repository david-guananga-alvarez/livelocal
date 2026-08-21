import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, hasSupabaseConfig } from './supabaseClient';
import { getProfile } from './profileService';

const MOCK_KEY = 'livelocal-auth-mock-user';
const AuthContext = createContext(null);

function loadMockUser(){
  try { return JSON.parse(localStorage.getItem(MOCK_KEY)); } catch { return null; }
}

export function AuthProvider({ children }){
  const [user, setUser] = useState(() => hasSupabaseConfig ? null : loadMockUser());
  const [loading, setLoading] = useState(Boolean(hasSupabaseConfig));
  const [profile, setProfile] = useState(hasSupabaseConfig ? null : { role: 'demo' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const reloadProfile = useCallback(async (nextUser = user) => {
    if(!hasSupabaseConfig){ setProfile({ role: 'demo' }); return; }
    if(!nextUser?.id){ setProfile(null); setProfileError(null); return; }
    setProfileLoading(true);
    setProfileError(null);
    try { setProfile(await getProfile(nextUser.id)); }
    catch(error){ setProfile(null); setProfileError(error?.message || 'No se pudo cargar tu perfil'); }
    finally { setProfileLoading(false); }
  }, [user]);

  useEffect(() => {
    if(!hasSupabaseConfig || !supabase){ setLoading(false); return; }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
      reloadProfile(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      reloadProfile(session?.user ?? null);
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
    setProfile({ id: mockUser.id, role: 'demo', full_name: 'David Demo' });
  }

  async function signOut(){
    if(hasSupabaseConfig && supabase){
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      return;
    }
    localStorage.removeItem(MOCK_KEY);
    setUser(null);
    setProfile({ role: 'demo' });
  }

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    hasSupabaseConfig,
    profile,
    role: profile?.role ?? null,
    profileLoading,
    profileError,
    reloadProfile,
    signInWithGoogle,
    signOut,
  }), [user, loading, profile, profileLoading, profileError, reloadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){
  const ctx = useContext(AuthContext);
  if(!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
