No blocking findings. Commit `62f9913` changes only timing sampling.

- Best-of-five preserves the scaling check: quadratic work grows approximately 4× when input doubles, exceeding the unchanged 3.5× bound. Taking minima at both sizes reduces scheduling/GC noise without dividing measured work by five. As before, timing checks are probabilistic, not a proof of complexity.
- The absolute bound remains **100 ms for each adversarial input**, using best-of-three. Consistently slow parsing still fails; isolated pauses can pass, which matches the stated purpose. This meaningfully changes tail-latency coverage, but does not materially weaken the parser-throughput guard.

Static review and `git diff --check` completed. Tests were not executed under the read-only reviewer scope.

Verdict: approve exact commit 62f9913