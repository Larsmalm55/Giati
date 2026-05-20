const { getStore } = require('@netlify/blobs');

const ADMIN_TOKEN = process.env.GIATI_ADMIN_TOKEN || 'giati-admin-2026';

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:204, headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'X-Admin-Token, Content-Type'}, body:'' };
  }

  const token = (event.headers['x-admin-token'] || event.headers['X-Admin-Token'] || '');
  if (token !== ADMIN_TOKEN) {
    return { statusCode:401, headers:{'Content-Type':'application/json'}, body: JSON.stringify({error:'Unauthorized'}) };
  }

  try {
    const store = getStore('giati-analytics');

    const statsRaw = await store.get('stats').catch(() => null);
    const stats = statsRaw ? JSON.parse(statsRaw) : {
      total_sessions:0, personas:{}, persona_avg_phase:{},
      phase_funnel:[0,0,0,0,0,0,0,0],
      score_dist:{'0':0,'1':0,'2':0},
      avg_phase:0, sessions_by_date:{}
    };

    const recentRaw = await store.get('recent_sessions').catch(() => null);
    const recent = recentRaw ? JSON.parse(recentRaw) : [];

    const today = new Date().toISOString().split('T')[0];
    const todayCount = (stats.sessions_by_date||{})[today] || 0;

    return {
      statusCode:200,
      headers:{'Content-Type':'application/json','Cache-Control':'no-cache, no-store'},
      body: JSON.stringify({ ...stats, today_sessions:todayCount, recent_sessions:recent.slice(0,25) })
    };
  } catch(err) {
    return { statusCode:500, body: JSON.stringify({error:err.message}) };
  }
};
