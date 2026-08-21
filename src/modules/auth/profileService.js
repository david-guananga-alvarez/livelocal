import { supabase } from './supabaseClient';

export async function getProfile(userId) {
  if (!supabase || !userId) throw new Error('No hay una sesión disponible');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, avatar_url, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Tu perfil todavía no está disponible');
  return data;
}
