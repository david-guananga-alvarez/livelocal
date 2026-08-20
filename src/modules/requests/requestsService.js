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
    target_latitude:
      request.targetLocation?.lat ?? null,
    target_longitude:
      request.targetLocation?.lng ?? null,
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

export async function acceptRequest(requestId, localId) {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  const { data, error } = await supabase
    .from('requests')
    .update({
      status: 'matched',
      local_id: localId,
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateRequestStatus(requestId, status) {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  const { data, error } = await supabase
    .from('requests')
    .update({ status })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;

  return data;
}
