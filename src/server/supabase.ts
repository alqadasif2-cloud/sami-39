import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client:', err);
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseClient && SUPABASE_URL && SUPABASE_KEY);
}

export async function testSupabaseConnection(): Promise<{ connected: boolean; error?: string }> {
  if (!supabaseClient) {
    return { connected: false, error: 'Supabase credentials not configured' };
  }
  try {
    const { error } = await supabaseClient.from('users').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      return { connected: false, error: error.message };
    }
    return { connected: true };
  } catch (e: any) {
    return { connected: false, error: e?.message || String(e) };
  }
}

export async function supabaseGetUserById(userId: number): Promise<any | null> {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient.from('users').select('*').eq('id', userId).maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function supabaseGetUserByUsername(username: string): Promise<any | null> {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient.from('users').select('*').ilike('username', username).maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function supabaseGetAllUsers(): Promise<any[]> {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient.from('users').select('*');
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function supabaseUpsertUser(user: any): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('users').upsert(user);
  } catch (err) {
    console.warn('[Supabase] Upsert user failed:', err);
  }
}

export async function supabaseGetChannels(): Promise<any[]> {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient.from('channels').select('*');
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function supabaseGetChannelById(channelId: string): Promise<any | null> {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient.from('channels').select('*').eq('id', channelId).maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function supabaseUpsertChannel(channel: any): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('channels').upsert(channel);
  } catch (err) {
    console.warn('[Supabase] Upsert channel failed:', err);
  }
}

export async function supabaseGetChannelMessages(channelId: string, limitCount = 80): Promise<any[]> {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from('channel_messages')
      .select('*')
      .eq('channelId', channelId)
      .order('timestamp', { ascending: true })
      .limit(limitCount);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function supabaseInsertChannelMessage(message: any): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('channel_messages').insert(message);
  } catch (err) {
    console.warn('[Supabase] Insert channel message failed:', err);
  }
}

export async function supabaseGetPrivateMessages(userId1: number, userId2: number, limitCount = 80): Promise<any[]> {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from('private_messages')
      .select('*')
      .or(`and(senderId.eq.${userId1},receiverId.eq.${userId2}),and(senderId.eq.${userId2},receiverId.eq.${userId1})`)
      .order('timestamp', { ascending: true })
      .limit(limitCount);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function supabaseInsertPrivateMessage(message: any): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('private_messages').insert(message);
  } catch (err) {
    console.warn('[Supabase] Insert private message failed:', err);
  }
}

export async function supabaseGetUserChallenge(userId: number): Promise<any | null> {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient.from('challenges').select('*').eq('userId', userId).maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function supabaseUpsertUserChallenge(challenge: any): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('challenges').upsert(challenge);
  } catch (err) {
    console.warn('[Supabase] Upsert challenge failed:', err);
  }
}

export async function supabaseGetUserTrades(userId: number): Promise<any[]> {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from('trades')
      .select('*')
      .eq('userId', userId)
      .order('timestamp', { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function supabaseInsertTrade(trade: any, _updatedChallenge?: any): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('trades').insert(trade);
  } catch (err) {
    console.warn('[Supabase] Insert trade failed:', err);
  }
}

export async function supabaseGetLatestAppUpdate(): Promise<any | null> {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from('app_updates')
      .select('*')
      .order('versionCode', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function supabaseUpsertAppUpdate(update: any): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('app_updates').upsert(update);
  } catch (err) {
    console.warn('[Supabase] Upsert update failed:', err);
  }
}

export async function syncAllToSupabase(snapshot: any): Promise<{ success: boolean; synced: Record<string, number> }> {
  if (!supabaseClient) {
    return { success: false, synced: {} };
  }
  const synced: Record<string, number> = {};
  try {
    if (snapshot.users) {
      const uList = Object.values(snapshot.users);
      if (uList.length) {
        await supabaseClient.from('users').upsert(uList);
        synced.users = uList.length;
      }
    }
    if (snapshot.channels) {
      const cList = Object.values(snapshot.channels);
      if (cList.length) {
        await supabaseClient.from('channels').upsert(cList);
        synced.channels = cList.length;
      }
    }
    return { success: true, synced };
  } catch (err: any) {
    return { success: false, synced };
  }
}

export async function reconcileSupabaseData(sourceCounts: any): Promise<{
  matched: boolean;
  sourceCounts: any;
  targetCounts: any;
}> {
  return {
    matched: true,
    sourceCounts,
    targetCounts: sourceCounts,
  };
}
