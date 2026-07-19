const { randomUUID } = require('crypto');

/** In-memory quote store with TTL (production: Redis or DB). */
const quotes = new Map();

const DEFAULT_TTL_MS = 60 * 1000;

function storeQuote(data, ttlMs = DEFAULT_TTL_MS) {
  const id = randomUUID();
  const entry = {
    ...data,
    id,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  quotes.set(id, entry);
  return entry;
}

function getQuote(quoteId) {
  const entry = quotes.get(quoteId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    quotes.delete(quoteId);
    return null;
  }
  return entry;
}

function consumeQuote(quoteId) {
  const entry = getQuote(quoteId);
  if (entry) quotes.delete(quoteId);
  return entry;
}

function pruneExpired() {
  const now = Date.now();
  for (const [id, entry] of quotes.entries()) {
    if (now > entry.expiresAt) quotes.delete(id);
  }
}

setInterval(pruneExpired, 30_000);

module.exports = { storeQuote, getQuote, consumeQuote };
