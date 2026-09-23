#!/usr/bin/env node
/**
 * How many people can watch a live at once before something gives.
 *
 * Finding this out during a real live is the expensive way. This does it on a
 * quiet afternoon instead: it opens as many simulated viewers as you ask for
 * and has each one behave exactly as the watch page does — fetch the page,
 * beat its heartbeat every fifteen seconds, poll for a newly pinned product
 * every eight, and optionally hold open a Realtime chat channel.
 *
 * What it does NOT do is pull video. Segments come from Cloudflare's CDN,
 * which is the one part of this that five hundred viewers cannot trouble, and
 * pretending otherwise would need a gigabit of bandwidth to learn nothing. The
 * parts that can break are ours: our API routes, our Postgres, and the
 * Realtime connection allowance on the Supabase plan. Those are what this
 * measures.
 *
 *   node scripts/live-load-test.mjs --site https://yourshop.com --live <id> --viewers 500
 *
 * Run it against a live that is actually on air — the viewer count and the
 * playback URL only exist while a live is running — and preferably one made
 * for the purpose, since its viewer count will show your simulated crowd.
 */

const HELP = `
Peak viewer load test

  node scripts/live-load-test.mjs --site <url> --live <id> [options]

Required
  --site <url>        Where the shop is deployed, e.g. https://yourshop.com
  --live <id>         The id of a live that is currently on air

Size and shape
  --viewers <n>       How many at once (default 500)
  --ramp <seconds>    Spread arrivals over this long (default 60)
  --minutes <n>       Hold them for this long once all have arrived (default 5)

What each viewer does
  --no-page           Skip the initial page load (keeps the test to the API)
  --chat              Also hold a Realtime chat channel open, as the page does.
                      Needs --supabase-url and --anon-key, or the usual
                      NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
  --comments <n>      Post roughly n comments a minute across the whole crowd
                      (default 0). Writes real comments to the real live.
  --manifest          Also fetch the HLS manifest, as a player would. Costs a
                      little Cloudflare traffic; off by default.

Other
  --help              This.

Stop it early with Ctrl-C; the report still prints.
`;

/* ------------------------------ the arguments ----------------------------- */

function parseArgs(argv) {
  const args = { viewers: 500, ramp: 60, minutes: 5, page: true, chat: false, comments: 0, manifest: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[(i += 1)];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--site") args.site = next();
    else if (a === "--live") args.live = next();
    else if (a === "--viewers") args.viewers = Number(next());
    else if (a === "--ramp") args.ramp = Number(next());
    else if (a === "--minutes") args.minutes = Number(next());
    else if (a === "--no-page") args.page = false;
    else if (a === "--chat") args.chat = true;
    else if (a === "--comments") args.comments = Number(next());
    else if (a === "--manifest") args.manifest = true;
    else if (a === "--supabase-url") args.supabaseUrl = next();
    else if (a === "--anon-key") args.anonKey = next();
    else {
      console.error(`Unknown option: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.site || !args.live) {
  console.log(HELP);
  process.exit(args.help ? 0 : 2);
}

const SITE = String(args.site).replace(/\/+$/, "");
const LIVE = args.live;
const VIEWERS = Math.max(1, args.viewers);
const RAMP_MS = Math.max(0, args.ramp) * 1000;
const HOLD_MS = Math.max(0, args.minutes) * 60_000;

// The real page's intervals, because a test on different ones is a test of
// something else.
const HEARTBEAT_MS = 15_000;
const POLL_MS = 8_000;
const MANIFEST_MS = 6_000;

// Every simulated viewer is stamped, so the rows they leave behind can be
// found and removed afterwards.
const RUN_ID = `loadtest-${Date.now().toString(36)}`;

/* -------------------------------- measuring ------------------------------- */

class Measure {
  constructor() {
    this.kinds = new Map();
  }

  kind(name) {
    let k = this.kinds.get(name);
    if (!k) {
      k = { name, ok: 0, failed: 0, latencies: [], statuses: new Map(), errors: new Map() };
      this.kinds.set(name, k);
    }
    return k;
  }

  record(name, ms, status, error) {
    const k = this.kind(name);
    k.latencies.push(ms);
    if (error) {
      k.failed += 1;
      k.errors.set(error, (k.errors.get(error) ?? 0) + 1);
      return;
    }
    k.statuses.set(status, (k.statuses.get(status) ?? 0) + 1);
    if (status >= 200 && status < 400) k.ok += 1;
    else k.failed += 1;
  }
}

const measure = new Measure();

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[i];
}

/** One request, timed, never throwing. */
async function timed(kind, url, init) {
  const started = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    // Read the body: a response not consumed is a response not really received.
    await res.arrayBuffer();
    measure.record(kind, Date.now() - started, res.status);
    return res;
  } catch (e) {
    const why = e?.name === "TimeoutError" ? "timeout" : (e?.cause?.code ?? e?.name ?? "error");
    measure.record(kind, Date.now() - started, 0, String(why));
    return null;
  }
}

/* -------------------------------- a viewer -------------------------------- */

let stopping = false;
const timers = new Set();
const channels = [];

function every(ms, fn) {
  // Spread the first call, so five hundred viewers do not all fire together
  // and measure a queue of their own making.
  const start = setTimeout(() => {
    fn();
    const t = setInterval(fn, ms);
    timers.add(t);
  }, Math.random() * ms);
  timers.add(start);
}

async function viewer(n, supabase) {
  if (stopping) return;
  const key = `${RUN_ID}-${n}`;

  if (args.page) await timed("page", `${SITE}/store/live/${LIVE}`);

  const beat = () =>
    timed("heartbeat", `${SITE}/api/storefront/lives/${LIVE}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    });
  beat();
  every(HEARTBEAT_MS, beat);

  every(POLL_MS, () => timed("poll", `${SITE}/api/storefront/lives/${LIVE}`));

  if (args.manifest && manifestUrl) {
    every(MANIFEST_MS, () => timed("manifest", manifestUrl));
  }

  if (supabase) {
    const channel = supabase.channel(`live:${LIVE}`, {
      config: { broadcast: { self: false }, presence: { key } },
    });
    channels.push(channel);
    const started = Date.now();
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") measure.record("realtime-join", Date.now() - started, 200);
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        measure.record("realtime-join", Date.now() - started, 0, status);
      }
    });
  }
}

/* --------------------------------- comments -------------------------------- */

function startComments() {
  if (args.comments <= 0) return;
  const gap = Math.max(200, 60_000 / args.comments);
  let n = 0;
  const t = setInterval(() => {
    n += 1;
    timed("comment", `${SITE}/api/storefront/lives/${LIVE}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ authorName: "Load test", body: `load test comment ${n}` }),
    });
  }, gap);
  timers.add(t);
}

/* -------------------------------- the report ------------------------------- */

let manifestUrl = null;
let reportedWatching = [];

function row(k) {
  const sorted = [...k.latencies].sort((a, b) => a - b);
  const total = k.ok + k.failed;
  const bad = k.failed ? `${k.failed} (${((k.failed / total) * 100).toFixed(1)}%)` : "0";
  return [
    k.name.padEnd(14),
    String(total).padStart(7),
    bad.padStart(14),
    `${percentile(sorted, 50)}ms`.padStart(9),
    `${percentile(sorted, 95)}ms`.padStart(9),
    `${percentile(sorted, 99)}ms`.padStart(9),
    `${sorted[sorted.length - 1] ?? 0}ms`.padStart(9),
  ].join(" ");
}

function report() {
  console.log(`\n${"=".repeat(78)}`);
  console.log(`Peak viewer test · ${VIEWERS} viewers · ${SITE}`);
  console.log("=".repeat(78));
  console.log(
    ["request".padEnd(14), "count".padStart(7), "failed".padStart(14), "p50".padStart(9), "p95".padStart(9), "p99".padStart(9), "worst".padStart(9)].join(" "),
  );
  console.log("-".repeat(78));

  let anyFailure = false;
  let slow = false;
  for (const k of measure.kinds.values()) {
    console.log(row(k));
    const sorted = [...k.latencies].sort((a, b) => a - b);
    if (k.failed > 0) anyFailure = true;
    if (percentile(sorted, 95) > 2000) slow = true;
    const problems = [...k.errors.entries()];
    const badStatuses = [...k.statuses.entries()].filter(([s]) => s >= 400);
    for (const [why, n] of problems) console.log(`               ${why}: ${n}`);
    for (const [s, n] of badStatuses) console.log(`               HTTP ${s}: ${n}`);
  }

  if (reportedWatching.length) {
    const last = reportedWatching[reportedWatching.length - 1];
    console.log("-".repeat(78));
    console.log(`Viewer count the shop reported: peaked at ${Math.max(...reportedWatching)}, ended at ${last}`);
    if (Math.max(...reportedWatching) < VIEWERS * 0.8) {
      console.log("  ! Well under the crowd simulated — heartbeats are being dropped or the");
      console.log("    counting window is too short. Worth looking at before blaming capacity.");
    }
  }

  console.log("=".repeat(78));
  if (anyFailure) console.log("VERDICT: requests failed. This crowd is more than the shop currently serves.");
  else if (slow) console.log("VERDICT: everything answered, but slowly. It holds, with no room spare.");
  else console.log(`VERDICT: ${VIEWERS} viewers served without a failure or a stumble.`);
  console.log(
    `\nRows left behind, to remove when you are done:\n` +
      `  delete from public.live_viewers where viewer_key like '${RUN_ID}%';\n`,
  );
}

/* ---------------------------------- run ----------------------------------- */

async function main() {
  console.log(`Checking ${SITE}/api/storefront/lives/${LIVE} …`);
  const probe = await fetch(`${SITE}/api/storefront/lives/${LIVE}`).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(`Could not read that live (${probe ? probe.status : "no answer"}). Check --site and --live.`);
    process.exit(1);
  }
  const body = await probe.json();
  const live = body?.data;
  if (!live) {
    console.error("That live returned nothing to watch.");
    process.exit(1);
  }
  if (live.status !== "live") {
    console.error(
      `That live is "${live.status}", not on air. The viewer count and playback only exist while it is running — start it first.`,
    );
    process.exit(1);
  }
  manifestUrl = live.playbackUrl ?? null;
  if (args.manifest && !manifestUrl) console.log("No playback URL yet; skipping manifest fetches.");

  let supabase = null;
  if (args.chat) {
    const url = args.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = args.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      console.error("--chat needs --supabase-url and --anon-key (or the NEXT_PUBLIC_ environment variables).");
      process.exit(2);
    }
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(url, anon, { realtime: { params: { eventsPerSecond: 10 } } });
    console.log("Realtime channels: on. Watch for CHANNEL_ERROR — that is the plan's connection ceiling, not your code.");
  }

  console.log(
    `Opening ${VIEWERS} viewers over ${args.ramp}s, holding ${args.minutes} min. Ctrl-C stops early.\n`,
  );

  const gap = VIEWERS > 1 ? RAMP_MS / (VIEWERS - 1) : 0;
  for (let n = 0; n < VIEWERS && !stopping; n += 1) {
    viewer(n, supabase);
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
  }
  startComments();

  // A line every five seconds, so a test that is going wrong can be stopped
  // rather than waited out.
  const ticker = setInterval(async () => {
    const res = await fetch(`${SITE}/api/storefront/lives/${LIVE}`).catch(() => null);
    const watching = res?.ok ? (await res.json())?.data?.watching : null;
    if (typeof watching === "number") reportedWatching.push(watching);
    const all = [...measure.kinds.values()];
    const total = all.reduce((n, k) => n + k.ok + k.failed, 0);
    const failed = all.reduce((n, k) => n + k.failed, 0);
    console.log(
      `  ${new Date().toLocaleTimeString()}  requests ${total}  failed ${failed}  shop reports ${watching ?? "?"} watching`,
    );
  }, 5000);
  timers.add(ticker);

  await new Promise((r) => setTimeout(r, HOLD_MS));
  finish();
}

function finish() {
  if (stopping) return;
  stopping = true;
  for (const t of timers) {
    clearTimeout(t);
    clearInterval(t);
  }
  for (const c of channels) c.unsubscribe?.();
  report();
  // Realtime holds the process open otherwise.
  setTimeout(() => process.exit(0), 250);
}

process.on("SIGINT", () => {
  console.log("\nStopping…");
  finish();
});

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
