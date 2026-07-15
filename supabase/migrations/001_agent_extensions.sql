-- Agent Builder extension: policies, audit log, approvals, spend sessions
-- Run in Supabase SQL editor or via migration tooling.

-- Extend agents table
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS agent_type TEXT NOT NULL DEFAULT 'general'
    CHECK (agent_type IN ('general', 'trading', 'shopping', 'hybrid')),
  ADD COLUMN IF NOT EXISTS policies JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tool_configs JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Agent action audit log (trades, orders, denials)
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  params_hash TEXT,
  policy_decision TEXT NOT NULL DEFAULT 'allow'
    CHECK (policy_decision IN ('allow', 'deny', 'pending_approval')),
  quote_snapshot JSONB,
  notional_usd NUMERIC(18, 6),
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed', 'denied', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_id ON agent_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at ON agent_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_actions_tool ON agent_actions(tool);

-- Human-in-the-loop approval queue
CREATE TABLE IF NOT EXISTS agent_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  action_id UUID REFERENCES agent_actions(id) ON DELETE SET NULL,
  tool TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_approvals_agent_status ON agent_approvals(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_approvals_expires ON agent_approvals(expires_at);

-- Shopping spend sessions (delegation-style budgets)
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  budget_usd NUMERIC(18, 6) NOT NULL,
  spent_usd NUMERIC(18, 6) NOT NULL DEFAULT 0,
  merchant_allowlist JSONB NOT NULL DEFAULT '["mock"]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'exhausted', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_status ON agent_sessions(agent_id, status);

-- RLS: users manage their own agent data (adjust if using service role only)
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Policies: agent owner via agents.user_id
-- Note: Postgres does not support CREATE POLICY IF NOT EXISTS — drop then recreate.
DROP POLICY IF EXISTS agent_actions_select_own ON agent_actions;
CREATE POLICY agent_actions_select_own ON agent_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents a WHERE a.id = agent_actions.agent_id AND a.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS agent_approvals_select_own ON agent_approvals;
CREATE POLICY agent_approvals_select_own ON agent_approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents a WHERE a.id = agent_approvals.agent_id AND a.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS agent_approvals_update_own ON agent_approvals;
CREATE POLICY agent_approvals_update_own ON agent_approvals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM agents a WHERE a.id = agent_approvals.agent_id AND a.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS agent_sessions_select_own ON agent_sessions;
CREATE POLICY agent_sessions_select_own ON agent_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents a WHERE a.id = agent_sessions.agent_id AND a.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS agent_sessions_insert_own ON agent_sessions;
CREATE POLICY agent_sessions_insert_own ON agent_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents a WHERE a.id = agent_sessions.agent_id AND a.user_id = auth.uid()::text
    )
  );
