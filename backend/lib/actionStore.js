const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  supabase = createClient(url, key);
  return supabase;
}

function requireSupabase() {
  return getSupabase();
}

async function logAction(record) {
  const client = requireSupabase();
  const { data, error } = await client.from('agent_actions').insert(record).select().single();
  if (error) throw error;
  return data;
}

async function getAgentActions(agentId, { tool, limit = 20 } = {}) {
  const client = requireSupabase();
  let q = client
    .from('agent_actions')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (tool) q = q.eq('tool', tool);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function getUserPrivateKey(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('users')
    .select('private_key, wallet_address')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

async function createApproval(record) {
  const client = requireSupabase();
  const agentId = record.agent_id || record.agentId;
  if (!agentId) {
    throw new Error('agent_id is required to create an approval');
  }

  const payload = { ...(record.payload || {}) };
  if (record.quote_snapshot) {
    payload.quote_snapshot = record.quote_snapshot;
  }

  const insert = {
    agent_id: agentId,
    tool: record.tool,
    summary: record.summary || 'Approval required',
    payload,
    expires_at: record.expires_at,
    status: record.status || 'pending',
  };

  const { data, error } = await client.from('agent_approvals').insert(insert).select().single();
  if (error) throw error;
  return data;
}

async function getApproval(approvalId) {
  const client = requireSupabase();
  const { data, error } = await client.from('agent_approvals').select('*').eq('id', approvalId).single();
  if (error) return null;
  return data;
}

async function resolveApproval(approvalId, status, resolvedBy) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('agent_approvals')
    .update({
      status,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', approvalId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getApprovedIds(agentId) {
  const client = requireSupabase();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('agent_approvals')
    .select('id')
    .eq('agent_id', agentId)
    .eq('status', 'approved')
    .gt('expires_at', now);
  if (error) throw error;
  return (data || []).map((row) => row.id);
}

async function createSession(record) {
  const client = requireSupabase();
  const { data, error } = await client.from('agent_sessions').insert(record).select().single();
  if (error) throw error;
  return data;
}

async function getActiveSession(agentId) {
  const client = requireSupabase();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('agent_sessions')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function incrementSessionSpend(sessionId, amountUsd) {
  const client = requireSupabase();
  const { data: session, error: fetchError } = await client
    .from('agent_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (fetchError) throw fetchError;
  if (!session) return null;

  const spent = Number(session.spent_usd || 0) + amountUsd;
  const status = spent >= Number(session.budget_usd) ? 'exhausted' : session.status;
  const { data, error } = await client
    .from('agent_sessions')
    .update({ spent_usd: spent, status })
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  getSupabase,
  requireSupabase,
  logAction,
  getAgentActions,
  getUserPrivateKey,
  createApproval,
  getApproval,
  resolveApproval,
  getApprovedIds,
  createSession,
  getActiveSession,
  incrementSessionSpend,
};
