const { getStore } = require('@netlify/blobs');

const MAX_STORED_MESSAGES = 60; // last 60 messages saved server-side

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { userId, personaId, messages, system, model, max_tokens } = body;

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 1000,
        system: system,
        messages: messages,
      }),
    });

    const data = await response.json();

    // Save conversation to Netlify Blobs if userId + personaId provided
    if (userId && personaId && data.content && data.content[0]) {
      try {
        const store = getStore('conversations');
        const key = `${userId}:${personaId}`;

        // Build updated conversation with assistant reply
        const assistantMsg = { role: 'assistant', content: data.content[0].text };
        const updatedMessages = [...messages, assistantMsg];

        // Keep only last MAX_STORED_MESSAGES to control storage size
        const trimmed = updatedMessages.slice(-MAX_STORED_MESSAGES);

        // Load existing metadata (phase, score) to preserve it
        let existing = {};
        try {
          existing = await store.get(key, { type: 'json' }) || {};
        } catch(e) {}

        await store.set(key, JSON.stringify({
          conv: trimmed,
          phase: body.phase !== undefined ? body.phase : (existing.phase || 0),
          score: body.score !== undefined ? body.score : (existing.score || 0),
          updatedAt: new Date().toISOString(),
        }));
      } catch (memErr) {
        // Memory save failed — chat still works, just not persisted
        console.error('Memory save error:', memErr.message);
      }
    }

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
