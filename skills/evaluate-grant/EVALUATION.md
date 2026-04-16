# Ipê Village 2026 — Grant Evaluation Criteria

Single source of truth for how AI Judge evaluates grant proposals.

## Tracks

Proposals must target one of two tracks:

- **Ipê City** — tools for residents to connect, earn, coordinate, and stay safe.
- **Veritas Village** — tools for a sustainable, self-governing residential community.

## Criteria (all five weigh into the score)

1. **Technical feasibility in 1 week** — can a small team realistically ship it?
2. **Alignment with network state / startup society values** — does it advance resident sovereignty, coordination, and exit?
3. **Real utility for village residents** — does it solve a concrete problem people have today?
4. **Use of AI or blockchain as core infrastructure** — is the tech load-bearing, not decorative?
5. **Community impact** — does it compound over time and benefit more than a single user?

## Output contract

Every judge persona MUST return exactly:

```json
{
  "score": 0-10,
  "justification": "2-3 sentences",
  "recommendation": "APPROVE | REVIEW | REJECT"
}
```

No preamble, no markdown, no code fences.
