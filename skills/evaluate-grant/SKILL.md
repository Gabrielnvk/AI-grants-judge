---
name: evaluate-grant
description: Evaluate an Ipê Village 2026 grant proposal through three parallel judge personas (techno-optimist, pragmatic, communalist), aggregate the verdict, and anchor it on Base mainnet. Use whenever a user submits a grant proposal via any channel.
metadata:
  {
    "openclaw":
      {
        "emoji": "🏛️",
        "requires": { "bins": ["node"] },
      },
  }
---

# evaluate-grant

Runs three judge personas in parallel against a proposal, aggregates their scores, and writes the verdict on Base.

## When to use

Any time a user submits a grant proposal — typically via `/avaliar [Name] [Description]` on Telegram, but also plain text on other channels. If the message contains a project name + description, run this skill.

## How to invoke

```bash
node skills/evaluate-grant/bin/evaluate.js \
  --name "Project Name" \
  --description "Full proposal text"
```

With a local video:

```bash
node skills/evaluate-grant/bin/evaluate.js \
  --name "Project Name" \
  --description "Full proposal text" \
  --video /tmp/clip.mp4
```

With a YouTube URL (works without download or cookies — the skill calls Gemini's native API which ingests YouTube URLs directly inside Google's network):

```bash
node skills/evaluate-grant/bin/evaluate.js \
  --name "Project Name" \
  --description "Full proposal text" \
  --video "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

With any other video URL (Vimeo, direct MP4, etc.) — the skill downloads via `yt-dlp` and sends the bytes to Gemini Flash through OpenRouter:

```bash
node skills/evaluate-grant/bin/evaluate.js \
  --name "Project Name" \
  --description "Full proposal text" \
  --video "https://vimeo.com/123456789"
```

Flags:

- `--name <string>` *(required)* — short project name
- `--description <string>` *(required)* — full description / pitch
- `--video <path-or-url>` *(optional)* — either a local video file path **or** a public video URL. YouTube URLs (`youtube.com`, `youtu.be`) are ingested natively via Google's Gemini API with no download step (no bot check, no cookies). Other URLs (Vimeo, direct MP4, CDN links) are downloaded via `yt-dlp` at ≤480p then sent as base64 to Gemini Flash through OpenRouter. Either way the resulting brief is folded into the judges' input.
- `--json` *(optional)* — print the raw aggregated JSON instead of the formatted message
- `--no-anchor` *(optional)* — skip the Base transaction (use for dry-runs)

## Output

Prints a Telegram-formatted string to stdout:

```
🏛️ AI JUDGE — Grant Evaluation

📋 Project: <name>

⚡ Techno-optimist: 8/10
"justification..."

🔧 Pragmatic: 6/10
"justification..."

🤝 Communalist: 9/10
"justification..."

🎯 Final Score: 7.7/10
Recommendation: ✅ APPROVED FOR REVIEW

🔗 Registered on Base: 0x...
```

Forward this verbatim to the user. Do not rewrite, embellish, or rescore.

## Environment

The skill reads these env vars (already set on the gateway):

- `OPENROUTER_API_KEY` — required for the three judges and video analysis
- `MODEL` — default `openai/gpt-5.4-nano` (override per-run with env)
- `GEMINI_VIDEO_MODEL` — default `google/gemini-2.5-flash`
- `WALLET_PRIVATE_KEY` — required for Base anchoring (skip with `--no-anchor`)
- `BASE_RPC_URL` — default `https://mainnet.base.org`

## Evaluation criteria (single source of truth)

See `EVALUATION.md` next to this file for the full Ipê Village 2026 grant criteria. The three judge personas all evaluate against it.
