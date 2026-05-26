const { getStore } = require('@netlify/blobs');

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { userId, personaId } = event.httpMethod === 'GET'
    ? event.queryStringParameters || {}
    : JSON.parse(event.body || '{}');

  if (!userId || !personaId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId and personaId required' }) };
  }

  try {
    const store = getStore('conversations');
    const key = `${userId}:${personaId}`;

    // GET — load memory
    if (event.httpMethod === 'GET') {
      try {
        const data = await store.get(key, { type: 'json' });
        if (!data) {
          return { statusCode: 200, headers, body: JSON.stringify({ found: false }) };
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ found: true, conv: data.conv, phase: data.phase, score: data.score, updatedAt: data.updatedAt }),
        };
      } catch(e) {
        return { statusCode: 200, headers, body: JSON.stringify({ found: false }) };
      }
    }

    // POST — save memory manually (phase/score updates)
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      let existing = {};
      try { existing = await store.get(key, { type: 'json' }) || {}; } catch(e) {}

      const updated = {
        conv: body.conv || existing.conv || [],
        phase: body.phase !== undefined ? body.phase : existing.phase,
        score: body.score !== undefined ? body.score : existing.score,
        updatedAt: new Date().toISOString(),
      };

      await store.set(key, JSON.stringify(updated));
      return { statusCode: 200, headers, body: JSON.stringify({ saved: true }) };
    }

    return { statusCode: 405, headers, body: 'Method Not Allowed' };

  } catch (err) {
    console.error('Memory error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
