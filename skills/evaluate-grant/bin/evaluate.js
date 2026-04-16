#!/usr/bin/env node
import { readFileSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve, join as pathJoin } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { config as loadDotenv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: pathResolve(__dirname, "..", ".env") });
import OpenAI from "openai";
import { createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    description: { type: "string" },
    video: { type: "string" },
    json: { type: "boolean", default: false },
    "no-anchor": { type: "boolean", default: false },
  },
  strict: false,
});

if (!values.name || !values.description) {
  console.error("Usage: evaluate.js --name <name> --description <text> [--video path] [--json] [--no-anchor]");
  process.exit(2);
}

const MODEL = process.env.MODEL || "openai/gpt-5.4-nano";
const VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || "google/gemini-2.5-flash";

if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is not set");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://openclaw.ai/",
    "X-Title": "AI Judge - Ipe Village 2026",
  },
});

const PERSONAS = [
  {
    id: "techno",
    label: "⚡ Techno-optimist",
    prompt:
      "You are a techno-optimist judge evaluating grant proposals for Ipê Village 2026. You prioritize bold use of AI, blockchain, and decentralized infrastructure. You reward ambition and technical innovation. Evaluate against the Ipê Village 2026 criteria (tracks: Ipê City and Veritas Village; five criteria: 1-week feasibility, network-state alignment, resident utility, AI/blockchain as core, community impact). Always respond in JSON only: {\"score\": 0-10, \"justification\": \"2-3 sentences\", \"recommendation\": \"APPROVE|REVIEW|REJECT\"}.",
  },
  {
    id: "pragmatic",
    label: "🔧 Pragmatic",
    prompt:
      "You are a pragmatic judge evaluating grant proposals for Ipê Village 2026. You prioritize what can realistically be built and deployed in 1 week by a small team. You penalize scope creep. Evaluate against the Ipê Village 2026 criteria (tracks: Ipê City and Veritas Village; five criteria: 1-week feasibility, network-state alignment, resident utility, AI/blockchain as core, community impact). Always respond in JSON only: {\"score\": 0-10, \"justification\": \"2-3 sentences\", \"recommendation\": \"APPROVE|REVIEW|REJECT\"}.",
  },
  {
    id: "communalist",
    label: "🤝 Communalist",
    prompt:
      "You are a community-values judge evaluating grant proposals for Ipê Village 2026. You prioritize alignment with startup society values, resident benefit, and long-term coordination. Evaluate against the Ipê Village 2026 criteria (tracks: Ipê City and Veritas Village; five criteria: 1-week feasibility, network-state alignment, resident utility, AI/blockchain as core, community impact). Always respond in JSON only: {\"score\": 0-10, \"justification\": \"2-3 sentences\", \"recommendation\": \"APPROVE|REVIEW|REJECT\"}.",
  },
];

function isUrl(s) {
  return /^https?:\/\//i.test(s);
}

function isYoutubeUrl(s) {
  return /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(s);
}

async function callGemini(model, url) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = {
    contents: [
      {
        parts: [
          { fileData: { fileUri: url, mimeType: "video/mp4" } },
          {
            text: "You are preparing input for a grant evaluation panel reviewing a proposal for Ipê Village 2026. Watch the attached video and write a concise, factual brief (8-15 bullets) covering: what the project is and what it demonstrates; concrete features, UI, or hardware shown; claims about users, scale, or traction; visible red flags, missing pieces, or scope creep; on-camera team presence or lack thereof. No preamble, no markdown headers, plain bullets only.",
          },
        ],
      },
    ],
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    const err = new Error(`Gemini ${res.status}: ${bodyText.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = JSON.parse(bodyText);
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function summarizeYoutubeNative(url) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  const primary = process.env.GEMINI_NATIVE_MODEL || "gemini-2.5-flash";
  const fallbacks = ["gemini-3-flash-preview", "gemini-2.0-flash", "gemini-2.5-pro"];
  const models = [primary, ...fallbacks.filter((m) => m !== primary)];
  let lastErr = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await callGemini(model, url);
      } catch (err) {
        lastErr = err;
        const retryable = err.status === 503 || err.status === 429 || err.status === 500;
        if (!retryable) break;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastErr ?? new Error("Gemini exhausted all fallbacks");
}

function downloadYoutube(url) {
  const dir = mkdtempSync(pathJoin(tmpdir(), "aijudge-yt-"));
  const out = pathJoin(dir, "video.%(ext)s");
  const cookiesPath = pathResolve(__dirname, "..", "cookies.txt");
  const args = [
    "--no-playlist",
    "--quiet",
    "--no-warnings",
    "--extractor-args",
    "youtube:player_client=tv_embedded,web_safari,mweb,android",
    "-f",
    "bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]/b[height<=480]",
    "--merge-output-format",
    "mp4",
    "-o",
    out,
  ];
  try {
    if (readFileSync(cookiesPath)) args.push("--cookies", cookiesPath);
  } catch {}
  args.push(url);
  const res = spawnSync("yt-dlp", args, { stdio: ["ignore", "inherit", "inherit"] });
  if (res.status !== 0) {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
    throw new Error(`yt-dlp exited with status ${res.status}`);
  }
  const files = readdirSync(dir);
  const file = files.find((f) => f.startsWith("video."));
  if (!file) {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
    throw new Error("yt-dlp produced no file");
  }
  return { path: pathJoin(dir, file), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

async function summarizeVideo(path) {
  const buf = readFileSync(path);
  const base64 = buf.toString("base64");
  const mime = path.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4";
  const dataUrl = `data:${mime};base64,${base64}`;
  const res = await client.chat.completions.create({
    model: VIDEO_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "file", file: { filename: path.split("/").pop(), file_data: dataUrl } },
          {
            type: "text",
            text: "You are preparing input for a grant evaluation panel reviewing a proposal for Ipê Village 2026. Write a concise, factual brief (8-15 bullets) covering: what is shown, features demonstrated, traction claims, visible red flags, team presence. Plain bullets only.",
          },
        ],
      },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

async function runJudge(persona, proposalText) {
  const res = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: persona.prompt },
      { role: "user", content: proposalText },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim() ?? "";
  const parsed = JSON.parse(text);
  return { id: persona.id, label: persona.label, ok: true, ...parsed };
}

async function anchorOnBase(name, score, recommendation) {
  if (!process.env.WALLET_PRIVATE_KEY) throw new Error("WALLET_PRIVATE_KEY not set");
  const pk = process.env.WALLET_PRIVATE_KEY;
  const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const wallet = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
  });
  const payload = { proposal: name, score, recommendation, timestamp: Date.now() };
  const data = toHex(JSON.stringify(payload));
  return wallet.sendTransaction({
    account,
    to: "0x0000000000000000000000000000000000000000",
    value: 0n,
    data,
  });
}

function finalRecommendation(avg, recs) {
  const approves = recs.filter((r) => r === "APPROVE").length;
  const rejects = recs.filter((r) => r === "REJECT").length;
  if (avg >= 8 && rejects === 0) return "✅ APPROVED FOR REVIEW";
  if (avg >= 6 || approves >= 2) return "🟡 NEEDS REVIEW";
  return "❌ REJECTED";
}

function formatMessage(name, judges, avg, verdict, txHash, failed) {
  const lines = [
    "🏛️ AI JUDGE — Grant Evaluation",
    "",
    `📋 Project: ${name}`,
    "",
  ];
  for (const j of judges) {
    if (j.ok) {
      lines.push(`${j.label}: ${j.score}/10`);
      lines.push(`"${j.justification}"`);
    } else {
      lines.push(`${j.label}: ⚠️ failed (${j.error})`);
    }
    lines.push("");
  }
  lines.push(`🎯 Final Score: ${avg.toFixed(1)}/10`);
  lines.push(`Recommendation: ${verdict}`);
  if (failed > 0) lines.push(`⚠️ ${failed} judge(s) failed — score averaged over the rest.`);
  if (txHash) {
    lines.push("");
    lines.push(`🔗 Registered on Base: ${txHash}`);
  }
  return lines.join("\n");
}

async function main() {
  let proposalText = `Project: ${values.name}\n\nDescription:\n${values.description}`;

  if (values.video) {
    let videoPath = values.video;
    let cleanup = null;
    try {
      let brief;
      if (isYoutubeUrl(values.video)) {
        brief = await summarizeYoutubeNative(values.video);
      } else {
        if (isUrl(values.video)) {
          const dl = downloadYoutube(values.video);
          videoPath = dl.path;
          cleanup = dl.cleanup;
        }
        brief = await summarizeVideo(videoPath);
      }
      proposalText += `\n\nVideo walkthrough brief (Gemini Flash):\n${brief}`;
    } catch (err) {
      console.error(`[warn] video analysis failed: ${err.message}`);
    } finally {
      if (cleanup) { try { cleanup(); } catch {} }
    }
  }

  if (process.env.DEBUG_JUDGE) {
    console.error(`[debug] OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY ? "set(" + process.env.OPENROUTER_API_KEY.length + ")" : "MISSING"} MODEL=${MODEL}`);
  }
  const settled = await Promise.all(
    PERSONAS.map(async (p) => {
      try {
        return await runJudge(p, proposalText);
      } catch (err) {
        if (process.env.DEBUG_JUDGE) {
          console.error(`[debug] ${p.id} failed:`, err.name, err.message, "status:", err.status, "cause:", err.cause?.code || err.cause?.message);
        }
        return { id: p.id, label: p.label, ok: false, error: err.message };
      }
    })
  );

  const ok = settled.filter((r) => r.ok);
  const avg = ok.length ? ok.reduce((s, r) => s + Number(r.score || 0), 0) / ok.length : 0;
  const verdict = finalRecommendation(avg, ok.map((r) => r.recommendation));
  const failed = settled.length - ok.length;

  let txHash = null;
  if (!values["no-anchor"]) {
    try {
      txHash = await anchorOnBase(values.name, Number(avg.toFixed(1)), verdict);
    } catch (err) {
      console.error(`[warn] base anchoring failed: ${err.message}`);
    }
  }

  if (values.json) {
    console.log(JSON.stringify({
      name: values.name,
      judges: settled,
      finalScore: Number(avg.toFixed(1)),
      verdict,
      txHash,
    }, null, 2));
  } else {
    console.log(formatMessage(values.name, settled, avg, verdict, txHash, failed));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
