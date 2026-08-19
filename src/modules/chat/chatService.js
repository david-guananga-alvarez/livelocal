import { supabase } from '../auth/supabaseClient';

export async function getMessages(requestId) {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', {
      ascending: true,
    });

  if (error) throw error;

  return data;
}

export async function sendMessage({
  requestId,
  senderId,
  senderRole,
  text,
}) {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      request_id: requestId,
      sender_id: senderId,
      sender_role: senderRole,
      text,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}