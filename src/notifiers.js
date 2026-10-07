async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res;
}

export async function notifyServerChan(title, body) {
  const key = process.env.SERVERCHAN_SENDKEY;
  if (!key) return false;
  const url = `https://sctapi.ftqq.com/${encodeURIComponent(key)}.send`;
  const form = new URLSearchParams({ title, desp: body });
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) throw new Error(`ServerChan HTTP ${res.status}: ${await res.text()}`);
  return true;
}

export async function notifyWxPusher(title, body, url) {
  const token = process.env.WXPUSHER_APP_TOKEN;
  const uids = (process.env.WXPUSHER_UIDS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!token || !uids.length) return false;
  await postJson("https://wxpusher.zjiecode.com/api/send/message", {
    appToken: token,
    content: body,
    summary: title,
    contentType: 1,
    uids,
    url
  });
  return true;
}

export async function sendWeChat({ title, body, url }) {
  const results = await Promise.allSettled([
    notifyServerChan(title, body),
    notifyWxPusher(title, body, url)
  ]);
  const delivered = results.some(r => r.status === "fulfilled" && r.value === true);
  const configured = Boolean(process.env.SERVERCHAN_SENDKEY || (process.env.WXPUSHER_APP_TOKEN && process.env.WXPUSHER_UIDS));
  if (!configured) throw new Error("No WeChat notifier configured. Set SERVERCHAN_SENDKEY or WXPUSHER_APP_TOKEN + WXPUSHER_UIDS.");
  if (!delivered) {
    const reasons = results.filter(r => r.status === "rejected").map(r => r.reason?.message || String(r.reason));
    throw new Error("All configured WeChat notifiers failed: " + reasons.join("; "));
  }
}
