import { getStore } from "@netlify/blobs";

const ADMIN_TOKEN = process.env.GIATI_ADMIN_TOKEN || "giati-admin-2026";

export default async (req, context) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "X-Admin-Token, Content-Type",
      },
    });
  }

  // Auth check
  const token = req.headers.get("X-Admin-Token") || "";
  if (token !== ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const store = getStore("giati-analytics");

    // Hent aggregerte stats
    const statsRaw = await store.get("stats").catch(() => null);
    const stats = statsRaw
      ? JSON.parse(statsRaw)
      : {
          total_sessions: 0,
          personas: {},
          persona_avg_phase: {},
          phase_funnel: [0, 0, 0, 0, 0, 0, 0, 0],
          score_dist: { "0": 0, "1": 0, "2": 0 },
          avg_phase: 0,
          sessions_by_date: {},
        };

    // Hent siste sessions-liste
    const recentRaw = await store.get("recent_sessions").catch(() => null);
    const recent = recentRaw ? JSON.parse(recentRaw) : [];

    // Today count
    const today = new Date().toISOString().split("T")[0];
    const todayCount = (stats.sessions_by_date || {})[today] || 0;

    return new Response(
      JSON.stringify({
        ...stats,
        today_sessions: todayCount,
        recent_sessions: recent.slice(0, 25),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store",
        },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/analytics",
};
