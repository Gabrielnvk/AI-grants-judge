# AI Judge — Ipê Village 2026 Grant Evaluator

A deliberation engine that evaluates grant proposals through three parallel AI judge personas and anchors verdicts on Base mainnet. Built on the [OpenClaw](https://github.com/openclaw) agent framework.

## How it works

1. A grant proposal arrives (via Telegram `/avaliar` command or any channel)
2. Three judge personas evaluate the proposal **in parallel**:
   - **Techno-optimist** — rewards bold AI/blockchain use, penalizes lack of technical ambition
   - **Pragmatist** — rewards 1-week feasibility, penalizes scope creep
   - **Communalist** — rewards alignment with startup society values and resident benefit
3. Scores are aggregated into a final verdict
4. The verdict is anchored on **Base mainnet** as an on-chain data transaction — receipts, not vibes

```
🏛️ AI JUDGE — Grant Evaluation

📋 Project: SolarSwap

⚡ Techno-optimist: 8/10
"Strong use of on-chain coordination primitives..."

🔧 Pragmatic: 6/10
"Feasible in a week if scoped to the swap module only..."

🤝 Communalist: 9/10
"Directly benefits residents with energy cost savings..."

🎯 Final Score: 7.7/10
Recommendation: ✅ APPROVED FOR REVIEW

🔗 Registered on Base: 0x...
```

## Evaluation criteria

Proposals target one of two tracks:

- **Ipê City** — tools for residents to connect, earn, coordinate, and stay safe
- **Veritas Village** — tools for a sustainable, self-governing residential community

Scored across five dimensions:

1. Technical feasibility in 1 week
2. Alignment with network state / startup society values
3. Real utility for village residents
4. Use of AI or blockchain as core infrastructure
5. Community impact over time

## Video analysis

The skill has built-in video support. Pass a YouTube URL, Vimeo link, or local file and it gets analyzed by Gemini Flash and folded into the judges' context.

```bash
node skills/evaluate-grant/bin/evaluate.js \
  --name "SolarSwap" \
  --description "P2P energy trading for village residents" \
  --video "https://www.youtube.com/watch?v=..."
```

- **YouTube URLs** — ingested natively via Google's Gemini API (no download needed)
- **Other URLs** (Vimeo, direct MP4) — downloaded via `yt-dlp`, sent to Gemini Flash through OpenRouter
- **Local files** — passed directly

## Setup

```bash
cd skills/evaluate-grant
npm install
cp .env.example .env
# Fill in your keys in .env
```

### Environment variables

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | API key for the three judge LLM calls |
| `MODEL` | LLM model for judges (default: `openai/gpt-5-mini`) |
| `GEMINI_API_KEY` | Google Gemini API key for native YouTube video analysis |
| `GEMINI_VIDEO_MODEL` | Video model via OpenRouter (default: `google/gemini-2.5-flash`) |
| `GEMINI_NATIVE_MODEL` | Native Gemini model (default: `gemini-2.5-flash`) |
| `WALLET_PRIVATE_KEY` | Base wallet private key for on-chain anchoring |
| `BASE_RPC_URL` | Base RPC endpoint (default: `https://mainnet.base.org`) |

## Usage

```bash
# Full evaluation with on-chain anchoring
node skills/evaluate-grant/bin/evaluate.js \
  --name "Project Name" \
  --description "Full proposal text"

# Dry run (no Base transaction)
node skills/evaluate-grant/bin/evaluate.js \
  --name "Project Name" \
  --description "Full proposal text" \
  --no-anchor

# Raw JSON output
node skills/evaluate-grant/bin/evaluate.js \
  --name "Project Name" \
  --description "Full proposal text" \
  --json
```

## OpenClaw structure

```
IDENTITY.md          — name, creature type, vibe
SOUL.md              — core truths and behavior rules
AGENTS.md            — workspace instructions and skill invocation
TOOLS.md             — environment-specific notes
USER.md              — user context
HEARTBEAT.md         — periodic task config
skills/
  evaluate-grant/
    bin/evaluate.js  — main evaluation script
    SKILL.md         — skill definition and invocation docs
    EVALUATION.md    — grant criteria (single source of truth)
```

## Stack

- **Node.js** — runtime
- **OpenRouter** — LLM routing for judge personas
- **Google Gemini** — video analysis
- **Viem** — Base blockchain interaction
- **OpenClaw** — agent framework

## License

MIT
