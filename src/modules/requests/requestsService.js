import { supabase } from '../auth/supabaseClient';

export async function createRequest(request) {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  const payload = {
    id: request.id,
    zone: request.zoneId,
    description: request.notes,
    duration_minutes: request.duration,
    status: request.status,
    client_id: request.clientId ?? null,
  };

  const { data, error } = await supabase
    .from('requests')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getRequests() {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}