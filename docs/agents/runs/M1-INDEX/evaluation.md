# Retrieval evaluation — synthetic, local and repeatable

Run: `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest discover -s tests -p 'test_indexing_*.py'`.
The labeled fixture is `tests/fixtures/indexing/retrieval.json`; the behavior check
`test_labeled_retrieval_evaluation` asserts the measured counts below. Uses real
SQLite FTS5 and APSW/sqlite-vec cosine KNN, with an explicitly synthetic injected
three-dimensional embedding function. No claim about Ollama/model quality, 250-repo
routing, production latency or the PRD's 50-task F03 gate is made.

| Task class | Tasks | Lexical correct at 10 | Hybrid correct at 10 |
| --- | ---: | ---: | ---: |
| Exact identifier | 3 | 3/3 | 3/3 |
| Intent/paraphrase | 3 | 2/3 | 3/3 |
| Ambiguous (both labeled paths required) | 1 | 1/1 | 1/1 |
| Absent (empty expected) | 1 | 1/1 | 0/1 |

For answerable tasks the metric is all labeled relevant paths present in top ten;
all have a single relevant path. Ambiguous and absent are reported separately.
The absent hybrid failure is intentional evidence: nearest neighbors are candidates,
not an answerability decision. F03 must evaluate abstention/ambiguity with a larger
labeled corpus and real configured embeddings before claiming routing readiness.
Lexical misses `delivery` because its source describes fulfillment/mail. `fulfillment`
and `billing` are found lexically (billing occurs in the path).

Incremental check: after one file changes/deletes, unchanged chunk text in the same
repository+namespace is reused without embedding transport calls. A different immutable
profile/model namespace does not reuse those vectors. Old snapshot citations remain exact.
