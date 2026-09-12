# Retrieval and Grounding Evaluation

`relocation-eval.v1.json` is the versioned deterministic benchmark for locality retrieval and assistant grounding. Each case records the question, expected evidence document IDs, required answer terms, and whether the question contains unsupported or missing-data requirements.

Run the evaluator from the repository root with:

```bash
npm --prefix backend run test:rag-eval
```

The default retrieval depth is `k=2`. Override it with `EVAL_K`, for example:

```bash
EVAL_K=3 npm --prefix backend run test:rag-eval
```

The evaluator measures precision@k, recall@k, evidence citation coverage, required evidence terms, and safe handling of unsupported requests. It writes a machine-readable report to `backend/evaluation/reports/latest.json`; use `EVAL_REPORT_PATH` to change the output path.

## Known failure cases

- Lexical retrieval can miss synonyms or differently phrased locality names. A production embedding/hybrid retriever should eventually be evaluated against the same cases.
- The benchmark is intentionally small, so its metrics indicate regression safety rather than statistically complete product quality.
- Live rent, safety, broadband, and commute data can become stale even when retrieval is correct. Answers should expose evidence age and source confidence as those fields are added to the data model.
- Conflicting sources currently trigger a cautious response but are not automatically reconciled by source authority or freshness.
- The deterministic answer builder verifies grounding mechanics; it does not score LLM style or factual reasoning quality. A separate offline LLM-judge or human review set can be layered on later without weakening this deterministic CI gate.

## Improvement ideas

Grow the versioned corpus by city and persona, add freshness/source-authority labels, evaluate hybrid lexical/vector retrieval, and retain historical reports in CI artifacts so metric drift can be graphed over time.
