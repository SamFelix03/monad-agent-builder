const { getProvider } = require('../commerce/registry');
const { buildSwapQuote, executeSwapFromQuote } = require('../lib/swapService');
const {
  logAction,
  getAgentActions,
  getUserPrivateKey,
  createApproval,
  getApproval,
  resolveApproval,
  createSession,
  getActiveSession,
  incrementSessionSpend,
} = require('../lib/actionStore');
const { getQuote } = require('../lib/quoteStore');

const SERVICE_SECRET = process.env.SERVICE_SECRET || 'dev-service-secret-change-me';

function requireServiceAuth(req, res, next) {
  const secret = req.headers['x-service-secret'] || req.body?.serviceSecret;
  if (secret !== SERVICE_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

function registerExtensionRoutes(app, { fetchTokenPriceUsd, getWalletAnalytics }) {
  // --- Quote swap (no execution) ---
  app.post('/quote-swap', async (req, res) => {
    try {
      const { privateKey, tokenIn, tokenOut, amountIn, slippageTolerance = 1, agentId } = req.body;
      if (!privateKey || !tokenIn || !tokenOut || !amountIn) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: privateKey, tokenIn, tokenOut, amountIn',
        });
      }
      const result = await buildSwapQuote({
        privateKey,
        tokenIn,
        tokenOut,
        amountIn,
        slippageTolerance,
        fetchPriceFn: fetchTokenPriceUsd,
      });
      if (agentId) {
        await logAction({
          agent_id: agentId,
          tool: 'quote_swap',
          policy_decision: 'allow',
          status: 'completed',
          quote_snapshot: result,
          notional_usd: result.notional_usd,
        }).catch(() => {});
      }
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  });

  // --- Portfolio ---
  app.post('/get-portfolio', async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ success: false, error: 'address is required' });
      }
      const analytics = await getWalletAnalytics(address);
      const positions = analytics?.tokens || analytics?.result?.tokens || [];
      let totalUsd = 0;
      const enriched = [];
      for (const pos of positions) {
        let usd = 0;
        try {
          const sym = (pos.symbol || pos.name || '').toLowerCase();
          const price = await fetchTokenPriceUsd(sym || 'monad');
          usd = parseFloat(pos.balance || pos.amount || 0) * (price?.usd || price?.price || 0);
        } catch {
          usd = 0;
        }
        totalUsd += usd;
        enriched.push({ ...pos, estimatedUsd: Math.round(usd * 100) / 100 });
      }
      return res.json({
        success: true,
        address,
        positions: enriched,
        totalEstimatedUsd: Math.round(totalUsd * 100) / 100,
        nativeBalance: analytics?.nativeBalance || analytics?.result?.nativeBalance,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- Agent actions history ---
  app.get('/agents/:agentId/actions', async (req, res) => {
    try {
      const { agentId } = req.params;
      const { tool, limit } = req.query;
      const actions = await getAgentActions(agentId, {
        tool: tool || undefined,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return res.json({ success: true, actions });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- Internal: server-side tool execution ---
  app.post('/internal/execute-tool', requireServiceAuth, async (req, res) => {
    try {
      const { userId, agentId, tool, parameters, policyContext } = req.body;
      if (!userId || !tool) {
        return res.status(400).json({ success: false, error: 'userId and tool required' });
      }

      const user = await getUserPrivateKey(userId);
      if (!user?.private_key) {
        return res.status(400).json({ success: false, error: 'User wallet not configured' });
      }

      const privateKey = user.private_key;
      const walletAddress = user.wallet_address;
      const params = { ...parameters, privateKey };
      let result;

      const toolRoutes = {
        transfer: { path: '/transfer', method: 'post' },
        swap: null,
        quote_swap: null,
        deploy_erc20: { path: '/deploy-token', method: 'post' },
        deploy_erc721: { path: '/create-nft-collection', method: 'post' },
        create_dao: { path: '/create-dao', method: 'post' },
        airdrop: { path: '/airdrop', method: 'post' },
        deposit_yield: { path: '/yield', method: 'post' },
      };

      if (tool === 'quote_swap') {
        result = await buildSwapQuote({
          privateKey,
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          slippageTolerance: params.slippageTolerance || 1,
          fetchPriceFn: fetchTokenPriceUsd,
        });
      } else if (tool === 'swap') {
        result = await executeSwapFromQuote({
          quoteId: params.quoteId,
          slippageTolerance: params.slippageTolerance,
          privateKey,
        });
      } else if (tool === 'get_portfolio') {
        const addr = params.address || walletAddress;
        const analytics = await getWalletAnalytics(addr);
        const positions = analytics?.tokens || [];
        let totalUsd = 0;
        for (const pos of positions) {
          try {
            const sym = (pos.symbol || 'monad').toLowerCase();
            const price = await fetchTokenPriceUsd(sym);
            totalUsd += parseFloat(pos.balance || 0) * (price?.usd || 0);
          } catch { /* skip */ }
        }
        result = {
          success: true,
          address: addr,
          positions,
          nativeBalance: analytics?.nativeBalance,
          totalEstimatedUsd: Math.round(totalUsd * 100) / 100,
        };
      } else if (toolRoutes[tool]) {
        const route = toolRoutes[tool];
        const axios = require('axios');
        const port = process.env.PORT || 3000;
        const base = `http://127.0.0.1:${port}`;
        const httpResp = await axios.post(`${base}${route.path}`, params, { timeout: 120000 });
        result = httpResp.data;
      } else {
        return res.status(400).json({ success: false, error: `Tool ${tool} not supported via internal execute` });
      }

      if (agentId) {
        await logAction({
          agent_id: agentId,
          tool,
          policy_decision: policyContext?.decision || 'allow',
          params_hash: policyContext?.params_hash,
          status: 'completed',
          quote_snapshot: policyContext?.quote_snapshot,
          notional_usd: result?.notional_usd || result?.totalEstimatedUsd,
          tx_hash: result?.swapTxHash || result?.transaction?.hash,
        }).catch(() => {});
      }

      return res.json({ success: true, tool, result });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- Approvals ---
  app.post('/internal/approvals', requireServiceAuth, async (req, res) => {
    try {
      const { agentId, tool, summary, payload, quote_snapshot } = req.body;
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const approval = await createApproval({
        agent_id: agentId,
        tool,
        summary,
        payload: payload || {},
        quote_snapshot,
        expires_at: expires,
        status: 'pending',
      });
      return res.json({ success: true, approval });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/approvals/:approvalId/resolve', async (req, res) => {
    try {
      const { approvalId } = req.params;
      const { status, resolvedBy } = req.body;
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, error: 'status must be approved or rejected' });
      }
      const approval = await resolveApproval(approvalId, status, resolvedBy || 'user');
      return res.json({ success: true, approval });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/approvals/:approvalId', async (req, res) => {
    try {
      const approval = await getApproval(req.params.approvalId);
      if (!approval) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, approval });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- Spend sessions ---
  app.post('/agents/:agentId/sessions', async (req, res) => {
    try {
      const { agentId } = req.params;
      const { userId, budgetUsd, merchantAllowlist, expiresInHours = 24 } = req.body;
      if (!userId || budgetUsd == null) {
        return res.status(400).json({ success: false, error: 'userId and budgetUsd required' });
      }
      const expires = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
      const session = await createSession({
        agent_id: agentId,
        user_id: userId,
        budget_usd: budgetUsd,
        merchant_allowlist: merchantAllowlist || ['mock'],
        expires_at: expires,
        status: 'active',
      });
      return res.json({ success: true, session });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/agents/:agentId/sessions/active', async (req, res) => {
    try {
      const session = await getActiveSession(req.params.agentId);
      return res.json({ success: true, session });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- Commerce ---
  app.post('/commerce/search', async (req, res) => {
    try {
      const { query, provider = 'mock', maxResults = 5 } = req.body;
      const p = getProvider(provider);
      const products = p.searchProducts(query, { maxResults });
      return res.json({ success: true, provider, products });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/commerce/product', async (req, res) => {
    try {
      const { productId, provider = 'mock' } = req.body;
      const p = getProvider(provider);
      const product = p.getProduct(productId);
      if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
      return res.json({ success: true, product });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/commerce/cart', async (req, res) => {
    try {
      const { items, provider = 'mock', agentId } = req.body;
      const p = getProvider(provider);
      const cart = p.createCart(items, provider);
      if (agentId) {
        await logAction({
          agent_id: agentId,
          tool: 'build_cart',
          policy_decision: 'allow',
          status: 'completed',
          quote_snapshot: cart,
          notional_usd: cart.subtotalUsd,
        }).catch(() => {});
      }
      return res.json({ success: true, cart });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/commerce/checkout-quote', async (req, res) => {
    try {
      const { cartId, provider = 'mock', agentId } = req.body;
      const p = getProvider(provider);
      const quote = p.getCheckoutQuote(cartId);
      if (agentId) {
        await logAction({
          agent_id: agentId,
          tool: 'checkout_quote',
          policy_decision: 'allow',
          status: 'completed',
          quote_snapshot: quote,
          notional_usd: quote.totalUsd,
        }).catch(() => {});
      }
      return res.json({ success: true, quote, total_usd: quote.totalUsd });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/commerce/place-order', async (req, res) => {
    try {
      const { cartId, approvalId, provider = 'mock', agentId } = req.body;

      if (approvalId) {
        const approval = await getApproval(approvalId);
        if (!approval || approval.status !== 'approved') {
          return res.status(403).json({
            success: false,
            error: 'Valid approved approvalId required for place_order',
          });
        }
      }

      const p = getProvider(provider);
      const order = p.placeOrder(cartId);

      if (agentId) {
        await logAction({
          agent_id: agentId,
          tool: 'place_order',
          policy_decision: 'allow',
          status: 'completed',
          quote_snapshot: order,
          notional_usd: order.totalUsd,
        }).catch(() => {});

        const session = await getActiveSession(agentId);
        if (session) {
          await incrementSessionSpend(session.id, order.totalUsd).catch(() => {});
        }
      }

      return res.json({ success: true, order });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  });

  // Quote lookup for policy engine
  app.get('/quotes/:quoteId', (req, res) => {
    const quote = getQuote(req.params.quoteId);
    if (!quote) return res.status(404).json({ success: false, error: 'Quote not found or expired' });
    const { privateKey, kuruQuote, ...safe } = quote;
    return res.json({ success: true, quote: safe });
  });
}

module.exports = { registerExtensionRoutes, requireServiceAuth, SERVICE_SECRET };
