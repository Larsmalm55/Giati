const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_TOKEN = process.env.GIATI_ADMIN_TOKEN || 'giati-admin-2026';

async function rGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

export const handler = async (event) => {
  const token = event.headers['x-admin-token'] || '';
  if (token !== ADMIN_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const stats = await rGet('stats') || {
      total_sessions: 0, personas: {}, persona_avg_phase: {},
      phase_funnel: [0,0,0,0,0,0,0,0],
      score_dist: {'0':0,'1':0,'2':0},
      avg_phase: 0, sessions_by_date: {}
    };

    const recent = await rGet('recent_sessions') || [];
    const today = new Date().toISOString().split('T')[0];
    const todayCount = (stats.sessions_by_date || {})[today] || 0;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ ...stats, today_sessions: todayCount, recent_sessions: recent.slice(0, 25) })
    };
  } catch(err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
