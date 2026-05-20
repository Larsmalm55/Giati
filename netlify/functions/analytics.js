const ADMIN_TOKEN = process.env.GIATI_ADMIN_TOKEN || 'giati-admin-2026';

exports.handler = async function(event) {
  const token = event.headers['x-admin-token'] || '';
  if (token !== ADMIN_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      total_sessions: 0, today_sessions: 0, avg_phase: 0,
      personas: {}, persona_avg_phase: {},
      phase_funnel: [0,0,0,0,0,0,0,0],
      score_dist: { '0':0, '1':0, '2':0 },
      recent_sessions: []
    })
  };
};
