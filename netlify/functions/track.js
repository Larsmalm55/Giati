async function rSet(key, value) {
  await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
}
