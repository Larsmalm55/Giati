import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { event, sessionId, persona, phase, score, messages, timestamp } = body;

  if (!event || !sessionId) {
    return new Response("Missing required fields: event, sessionId", { status: 400 });
  }

  try {
    const store = getStore("giati-analytics");

    // Hent og oppdater global stats atomisk
    const statsRaw = await store.get("stats").catch(() => null);
    const stats = statsRaw
      ? JSON.parse(statsRaw)
      : {
          total_sessions: 0,
          personas: {},
          persona_avg_phase: {},
          persona_phase_sum: {},
          persona_session_count: {},
          phase_funnel: [0, 0, 0, 0, 0, 0, 0, 0],
          score_dist: { "0": 0, "1": 0, "2": 0 },
          avg_phase: 0,
          total_phase_sum: 0,
          sessions_by_date: {},
        };

    // ── session_start ──────────────────────────────────────────────
    if (event === "session_start" && persona) {
      stats.total_sessions = (stats.total_sessions || 0) + 1;
      stats.personas = stats.personas || {};
      stats.personas[persona] = (stats.personas[persona] || 0) + 1;

      // Daglig teller
      const today = new Date().toISOString().split("T")[0];
      stats.sessions_by_date = stats.sessions_by_date || {};
      stats.sessions_by_date[today] = (stats.sessions_by_date[today] || 0) + 1;

      // Alle starter på fase 0
      stats.phase_funnel = stats.phase_funnel || [0, 0, 0, 0, 0, 0, 0, 0];
      stats.phase_funnel[0] = (stats.phase_funnel[0] || 0) + 1;
    }

    // ── phase_advance ──────────────────────────────────────────────
    if (event === "phase_advance" && phase !== undefined && phase >= 0 && phase < 8) {
      stats.phase_funnel = stats.phase_funnel || [0, 0, 0, 0, 0, 0, 0, 0];
      stats.phase_funnel[phase] = (stats.phase_funnel[phase] || 0) + 1;
    }

    // ── message (score tracking) ───────────────────────────────────
    if (event === "message" && score !== undefined) {
      const k = String(score);
      stats.score_dist = stats.score_dist || { "0": 0, "1": 0, "2": 0 };
      stats.score_dist[k] = (stats.score_dist[k] || 0) + 1;
    }

    // ── session_end ────────────────────────────────────────────────
    if (event === "session_end" && persona && phase !== undefined) {
      stats.persona_phase_sum = stats.persona_phase_sum || {};
      stats.persona_session_count = stats.persona_session_count || {};
      stats.persona_avg_phase = stats.persona_avg_phase || {};

      stats.persona_phase_sum[persona] =
        (stats.persona_phase_sum[persona] || 0) + phase;
      stats.persona_session_count[persona] =
        (stats.persona_session_count[persona] || 0) + 1;
      stats.persona_avg_phase[persona] =
        stats.persona_phase_sum[persona] / stats.persona_session_count[persona];

      // Overordnet snittfase
      stats.total_phase_sum = (stats.total_phase_sum || 0) + phase;
      if (stats.total_sessions > 0) {
        stats.avg_phase = stats.total_phase_sum / stats.total_sessions;
      }

      // Legg til i recent_sessions
      const recentRaw = await store.get("recent_sessions").catch(() => null);
      const recent = recentRaw ? JSON.parse(recentRaw) : [];

      const sessionEntry = {
        id: sessionId,
        persona,
        start: timestamp ? new Date(timestamp).getTime() : Date.now(),
        phase,
        messages: messages || 0,
        score: score || 0,
        duration: Math.round((messages || 0) * 0.75), // estimert varighet i minutter
      };

      recent.unshift(sessionEntry);
      // Behold siste 100
      await store.set("recent_sessions", JSON.stringify(recent.slice(0, 100)));
    }

    // Lagre oppdaterte stats
    await store.set("stats", JSON.stringify(stats));

    return new Response(JSON.stringify({ ok: true, event }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Track error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/track",
};
