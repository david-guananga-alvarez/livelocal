import { supabase } from '../auth/supabaseClient';

function mapPoint(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    createdBy: row.created_by,
    type: row.suggestion_type || 'point',
    title: row.title || '',
    location: { lat: Number(row.latitude), lng: Number(row.longitude) },
    route: Array.isArray(row.route)
      ? row.route.map(vertex => ({ lat: Number(vertex.lat), lng: Number(vertex.lng) }))
      : [],
    instruction: row.instruction || '',
    createdAt: row.created_at,
  };
}

export async function getSessionPoints(requestId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('session_map_points')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapPoint);
}

export async function createSessionPoint({
  requestId,
  location,
  instruction,
  type = 'point',
  title = '',
  route = [],
}) {
  if (!supabase) throw new Error('Supabase no está configurado');
  const { data, error } = await supabase
    .from('session_map_points')
    .insert({
      request_id: requestId,
      latitude: location.lat,
      longitude: location.lng,
      instruction: instruction.trim() || null,
      suggestion_type: type,
      title: title.trim() || null,
      route: type === 'route' ? route : null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapPoint(data);
}

export async function deleteSessionPoint(pointId) {
  if (!supabase) throw new Error('Supabase no está configurado');
  const { error } = await supabase.from('session_map_points').delete().eq('id', pointId);
  if (error) throw error;
}

export function subscribeToSessionPoints(requestId, onChange) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`session-map-points-${requestId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'session_map_points',
      filter: `request_id=eq.${requestId}`,
    }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
