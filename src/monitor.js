import fs from "node:fs";
import crypto from "node:crypto";
import { classifyPost } from "./classify.js";
import { formatChinaTime, inferResetTime } from "./time.js";
import { sendWeChat } from "./notifiers.js";

const FEED_URL = process.env.TIBO_RESET_FEED_URL || "https://tibo-reset-reminder-skill.vercel.app/api/feed";
const STATE_PATH = process.env.STATE_PATH || "state/notified.json";
const BOOTSTRAP_NOTIFY_LATEST = (process.env.BOOTSTRAP_NOTIFY_LATEST || "true").toLowerCase() === "true";
const BOOTSTRAP_MAX_AGE_HOURS = Number(process.env.BOOTSTRAP_MAX_AGE_HOURS || 24);
const ALERT_ON_HINTS = (process.env.ALERT_ON_HINTS || "false").toLowerCase() === "true";

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { version: 1, initialized: false, seen: {}, notified: {} };
  }
}

function saveState(state) {
  fs.mkdirSync(new URL(".", "file://" + process.cwd() + "/" + STATE_PATH).pathname, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

function textHash(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function normalizePost(raw) {
  const id = String(raw.id || raw.post_id || raw.tweet_id || raw.rest_id || "");
  const text = String(raw.text || raw.full_text || raw.content || raw.note_tweet?.text || "").trim();
  const createdAt = raw.created_at || raw.createdAt || raw.timestamp || raw.date || null;
  const url = raw.url || raw.permalink || raw.link || (id ? `https://x.com/thsottiaux/status/${id}` : "https://x.com/thsottiaux");
  if (!id || !text || !createdAt) return null;
  const hash = textHash(text);
  return { id, text, createdAt, url, versionKey: `${id}:${hash}` };
}

async function fetchPosts() {
  const res = await fetch(FEED_URL, {
    headers: { "user-agent": "tibo-reset-wechat/0.1 (+github-actions)" }
  });
  if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
  const body = await res.json();
  if (body?.stale === true) throw new Error("Feed is stale; refusing to treat stale data as current.");

  const candidates = Array.isArray(body) ? body
    : Array.isArray(body.posts) ? body.posts
    : Array.isArray(body.items) ? body.items
    : Array.isArray(body.data) ? body.data
    : [];

  if (!candidates.length) throw new Error("Feed returned no recognizable posts.");
  return candidates.map(normalizePost).filter(Boolean)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function titleFor(kind) {
  if (kind === "completed") return "🔥 Tibo Reset：已执行";
  if (kind === "banked") return "🏦 Tibo Reset：Banked reset";
  if (kind === "scheduled") return "⏰ Tibo Reset：计划重置";
  return "👀 Tibo Reset：新线索";
}

function buildMessage(post, classification) {
  const inferred = inferResetTime(post.text, post.createdAt);
  const resetTime = classification.kind === "completed"
    ? "已执行（以该帖时间作为确认时间）"
    : inferred
      ? formatChinaTime(inferred)
      : "原帖未给出可可靠换算的精确时刻";

  return [
    `Tibo：${post.text}`,
    "",
    `发帖时间（北京时间）：${formatChinaTime(post.createdAt)}`,
    `重置时间（北京时间）：${resetTime}`,
    `类型：${classification.kind}`,
    "",
    `原帖：${post.url}`,
    classification.kind === "completed" ? "现在可以安排烧额度了。" : "请按这个时间安排额度使用。"
  ].join("\n");
}

async function deliver(post, classification, state) {
  if (state.notified[post.versionKey]) return false;
  await sendWeChat({
    title: titleFor(classification.kind),
    body: buildMessage(post, classification),
    url: post.url
  });
  state.notified[post.versionKey] = {
    postId: post.id,
    notifiedAt: new Date().toISOString(),
    kind: classification.kind
  };
  return true;
}

async function main() {
  const state = loadState();
  const posts = await fetchPosts();

  if (!state.initialized) {
    for (const post of posts) state.seen[post.versionKey] = new Date().toISOString();

    if (BOOTSTRAP_NOTIFY_LATEST) {
      const now = Date.now();
      const actionable = posts
        .map(post => ({ post, c: classifyPost(post.text) }))
        .filter(({ c }) => c.actionable || (ALERT_ON_HINTS && c.kind === "hint"))
        .filter(({ post }) => now - new Date(post.createdAt).getTime() <= BOOTSTRAP_MAX_AGE_HOURS * 3600000)
        .at(-1);

      if (actionable) await deliver(actionable.post, actionable.c, state);
    }

    state.initialized = true;
    state.initializedAt = new Date().toISOString();
    saveState(state);
    console.log("Initialized baseline with", posts.length, "posts.");
    return;
  }

  let notifiedCount = 0;
  for (const post of posts) {
    if (state.seen[post.versionKey]) continue;
    const c = classifyPost(post.text);
    if (c.actionable || (ALERT_ON_HINTS && c.kind === "hint")) {
      if (await deliver(post, c, state)) notifiedCount++;
    }
    state.seen[post.versionKey] = new Date().toISOString();
  }

  const keys = Object.keys(state.seen);
  if (keys.length > 2000) {
    for (const key of keys.slice(0, keys.length - 1500)) delete state.seen[key];
  }

  saveState(state);
  console.log(`Processed ${posts.length} posts; sent ${notifiedCount} notification(s).`);
}

main().catch(err => {
  console.error(err?.stack || err);
  process.exitCode = 1;
});
