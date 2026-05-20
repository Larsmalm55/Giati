const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function rGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function rSet(key, value) {
  await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { event: ev, sessionId, persona, phase, score, messages, timestamp } = body;
  if (!ev || !sessionId) {
    return { statusCode: 400, body: 'Missing fields' };
  }

  try {
    const stats = await rGet('stats') || {
      total_sessions: 0, personas: {}, persona_avg_phase: {},
      persona_phase_sum: {}, persona_session_count: {},
      phase_funnel: [0,0,0,0,0,0,0,0],
      score_dist: {'0':0,'1':0,'2':0},
      avg_phase: 0, total_phase_sum: 0, sessions_by_date: {}
    };

    if (ev === 'session_start' && persona) {
      stats.total_sessions = (stats.total_sessions || 0) + 1;
      stats.personas[persona] = (stats.personas[persona] || 0) + 1;
      const today = new Date().toISOString().split('T')[0];
      stats.sessions_by_date[today] = (stats.sessions_by_date[today] || 0) + 1;
      stats.phase_funnel[0] = (stats.phase_funnel[0] || 0) + 1;
    }

    if (ev === 'phase_advance' && phase >= 0 && phase < 8) {
      stats.phase_funnel[phase] = (stats.phase_funnel[phase] || 0) + 1;
    }

    if (ev === 'message' && score !== undefined) {
      const k = String(score);
      stats.score_dist[k] = (stats.score_dist[k] || 0) + 1;
    }

    if (ev === 'session_end' && persona && phase !== undefined) {
      stats.persona_phase_sum[persona] = (stats.persona_phase_sum[persona] || 0) + phase;
      stats.persona_session_count[persona] = (stats.persona_session_count[persona] || 0) + 1;
      stats.persona_avg_phase[persona] = stats.persona_phase_sum[persona] / stats.persona_session_count[persona];
      stats.total_phase_sum = (stats.total_phase_sum || 0) + phase;
      stats.avg_phase = stats.total_phase_sum / stats.total_sessions;

      const recent = await rGet('recent_sessions') || [];
      recent.unshift({
        id: sessionId, persona,
        start: timestamp ? new Date(timestamp).getTime() : Date.now(),
        phase, messages: messages || 0, score: score || 0,
        duration: Math.round((messages || 0) * 0.75)
      });
      await rSet('recent_sessions', recent.slice(0, 100));
    }

    await rSet('stats', stats);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch(err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
