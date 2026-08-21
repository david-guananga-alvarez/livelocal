import { supabase } from '../auth/supabaseClient';

export async function goOnline(userId, location = null) {
  if (!supabase) {
    return { user_id: userId, is_online: true, ...location };
  }

  const payload = {
    user_id: userId,
    is_online: true,
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    accuracy: location?.accuracy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('locals')
    .upsert(payload, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function goOffline(userId) {
  if (!supabase) {
    return { user_id: userId, is_online: false };
  }

  const { data, error } = await supabase
    .from('locals')
    .upsert(
      {
        user_id: userId,
        is_online: false,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getLocalStatus(userId) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('locals')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}
export async function updateLocalLocation(userId, location) {
  if (!supabase) {
    return { user_id: userId, ...location };
  }

  const { data, error } = await supabase
    .from('locals')
    .update({
      latitude: location.lat,
      longitude: location.lng,
      accuracy: location.accuracy ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;

  return data;
}
export async function getLocals() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('locals').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}
