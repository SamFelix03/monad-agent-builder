/** Mock commerce provider for local dev and demos. */
const products = [
  {
    id: 'mock-001',
    title: 'Wireless Bluetooth Headphones',
    priceUsd: 49.99,
    category: 'electronics',
    provider: 'mock',
    description: 'Noise-cancelling over-ear headphones with 30h battery.',
    rating: 4.5,
  },
  {
    id: 'mock-002',
    title: 'Mechanical Keyboard',
    priceUsd: 89.99,
    category: 'electronics',
    provider: 'mock',
    description: 'RGB mechanical keyboard with Cherry MX switches.',
    rating: 4.7,
  },
  {
    id: 'mock-003',
    title: 'USB-C Hub 7-in-1',
    priceUsd: 34.99,
    category: 'electronics',
    provider: 'mock',
    description: 'HDMI, USB 3.0, SD card reader hub for laptops.',
    rating: 4.3,
  },
  {
    id: 'mock-004',
    title: 'Standing Desk Mat',
    priceUsd: 29.99,
    category: 'office',
    provider: 'mock',
    description: 'Anti-fatigue mat for standing desks.',
    rating: 4.6,
  },
  {
    id: 'mock-005',
    title: 'Programmable Coffee Maker',
    priceUsd: 59.99,
    category: 'kitchen',
    provider: 'mock',
    description: '12-cup programmable drip coffee maker.',
    rating: 4.4,
  },
];

const carts = new Map();
const orders = new Map();

function extractPriceFilters(query) {
  const text = (query || '').trim();
  let maxPriceUsd = null;
  let minPriceUsd = null;
  let cleaned = text;

  const underMatch = text.match(
    /(?:under|below|less\s+than|max(?:imum)?|up\s+to|<=?)\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:usd|dollars?)?/i
  );
  if (underMatch) {
    maxPriceUsd = parseFloat(underMatch[1]);
    cleaned = cleaned.replace(underMatch[0], ' ').trim();
  }

  const overMatch = text.match(
    /(?:over|above|more\s+than|min(?:imum)?|>=?)\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:usd|dollars?)?/i
  );
  if (overMatch) {
    minPriceUsd = parseFloat(overMatch[1]);
    cleaned = cleaned.replace(overMatch[0], ' ').trim();
  }

  const rangeMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*[-–]\s*\$?(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    minPriceUsd = parseFloat(rangeMatch[1]);
    maxPriceUsd = parseFloat(rangeMatch[2]);
    cleaned = cleaned.replace(rangeMatch[0], ' ').trim();
  }

  return { cleaned, maxPriceUsd, minPriceUsd };
}

const PRICE_STOP_WORDS = new Set([
  'under', 'below', 'less', 'than', 'over', 'above', 'more', 'usd', 'dollar', 'dollars',
  'cheap', 'affordable', 'budget', 'price', 'priced', 'cost', 'maximum', 'minimum', 'max', 'min',
]);

function searchProducts(query, { maxResults = 5, maxPriceUsd, minPriceUsd } = {}) {
  const extracted = extractPriceFilters(query);
  const effectiveMax = maxPriceUsd ?? extracted.maxPriceUsd;
  const effectiveMin = minPriceUsd ?? extracted.minPriceUsd;

  let searchText = extracted.cleaned || query || '';
  searchText = searchText.replace(/\$\s*\d+(?:\.\d+)?/g, ' ').trim();

  const terms = searchText
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term && !PRICE_STOP_WORDS.has(term) && !/^\d+$/.test(term));

  return products
    .filter((p) => {
      if (effectiveMax != null && p.priceUsd > effectiveMax) return false;
      if (effectiveMin != null && p.priceUsd < effectiveMin) return false;
      if (!terms.length) return true;
      const haystack = `${p.title} ${p.description} ${p.category}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .sort((a, b) => a.priceUsd - b.priceUsd)
    .slice(0, maxResults);
}

function getProduct(productId) {
  return products.find((p) => p.id === productId) || null;
}

function createCart(items, provider = 'mock') {
  const id = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const lineItems = items.map((item) => {
    const product = getProduct(item.productId);
    if (!product) throw new Error(`Unknown product: ${item.productId}`);
    return {
      productId: item.productId,
      quantity: item.quantity || 1,
      title: product.title,
      unitPriceUsd: product.priceUsd,
      lineTotalUsd: product.priceUsd * (item.quantity || 1),
    };
  });
  const subtotal = lineItems.reduce((s, i) => s + i.lineTotalUsd, 0);
  const cart = {
    id,
    provider,
    items: lineItems,
    subtotalUsd: subtotal,
    createdAt: new Date().toISOString(),
  };
  carts.set(id, cart);
  return cart;
}

function getCart(cartId) {
  return carts.get(cartId) || null;
}

function getCheckoutQuote(cartId) {
  const cart = getCart(cartId);
  if (!cart) throw new Error('Cart not found');
  const taxUsd = Math.round(cart.subtotalUsd * 0.08 * 100) / 100;
  const shippingUsd = cart.subtotalUsd >= 50 ? 0 : 5.99;
  const totalUsd = Math.round((cart.subtotalUsd + taxUsd + shippingUsd) * 100) / 100;
  return {
    cartId,
    provider: cart.provider,
    subtotalUsd: cart.subtotalUsd,
    taxUsd,
    shippingUsd,
    totalUsd,
    currency: 'USD',
    items: cart.items,
  };
}

function placeOrder(cartId) {
  const quote = getCheckoutQuote(cartId);
  const orderId = `order-${Date.now()}`;
  const order = {
    id: orderId,
    cartId,
    provider: quote.provider,
    totalUsd: quote.totalUsd,
    status: 'confirmed',
    placedAt: new Date().toISOString(),
    items: quote.items,
  };
  orders.set(orderId, order);
  carts.delete(cartId);
  return order;
}

module.exports = {
  id: 'mock',
  label: 'Mock Store',
  description: 'Local demo catalog for development and testing',
  searchProducts,
  getProduct,
  createCart,
  getCart,
  getCheckoutQuote,
  placeOrder,
};
