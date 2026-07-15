const mock = require('./mock');

const providers = {
  mock,
};

function getProvider(id = 'mock') {
  const provider = providers[id];
  if (!provider) throw new Error(`Unknown commerce provider: ${id}`);
  return provider;
}

function listProviders() {
  return Object.keys(providers);
}

module.exports = { getProvider, listProviders };
