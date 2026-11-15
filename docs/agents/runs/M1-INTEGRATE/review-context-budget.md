**APPROVED: exact commit `041901ab61a78e3bc757e76e70dffb0e061fd32f`** (base `f43ce11`, 3 files, hashes per manifest). I found no blocking problems. I could only read and search, so I ran no tests. The "32 old + 5 new checks passed" result comes from the author, and the full regression suite still needs to be run by whoever integrates this.

**What I checked against `conversations.py` in the snapshot:**
- **Output and repair reserve.** The input budget is `(context_limit - max_output_tokens)*4 - 256`. The Ollama adapter sends `num_ctx=context_limit` and `num_predict=max_output_tokens` (`adapters.py:48`), so the reserve matches what goes on the wire. The 256 bytes cover the ~150-byte repair message plus per-message overhead.
- **Latest prompt kept whole.** The fixed cost (system + request + scope) is checked first, and the run raises `ContextOverflow` before transport if it doesn't fit. The prompt is never clipped. The test asserts `transport.calls == 0` and that the stored content is unchanged.
- **History is bounded.** The cap is `min(8000, remaining//3)` and is measured on the serialized entry, not the raw content. It stops at the first entry that doesn't fit, so kept history is always a contiguous run of the newest turns. History citations are collected only for messages that were actually included.
- **Evidence packing counts metadata.** Each hit is measured with its full identity (repo, snapshot, revision, path, lines) plus text, against the real serialized payload. If one hit doesn't fit it is skipped and packing continues, and keys stay consecutive (`e{len+1}`). `chunk_id`, `rank` and `methods` are no longer sent. Citation checks and the `cited` mapping only use the six identity fields, which are still present.
- **Native schema only when advertised.** The schema is built only for the `answer` intent and only when the profile has `structured_output`. `roles()` and `generate()` both resolve the profile's `active_version_id`, so they read the same config. Plans and chat-only profiles still go through server-side validation and repair. With no evidence, the schema becomes `maxItems:0`, so the model can't invent citation IDs.
- **No regression in source policy or lease fencing.** Re-validation before sending, the `contains_source` flag, `_fence` at every phase and the error-code allowlist are all unchanged.

**Non-blocking findings, in priority order:**
1. **Medium: bytes/4 underestimates tokens for code, which matters for Ollama.** JSON-escaped source often runs about 3–3.5 bytes per token. With the defaults (8192 context, 1024 output), packing near the limit could mean about 1.2–2k more real tokens than estimated, which eats the 1024-token output reserve. Ollama then reports `done_reason=length`, which becomes `InvalidOutput`. The repair retry sends the same prompt plus more text, fails again, and the run ends as `invalid_output`. The contract already says the estimate isn't exact, so this isn't blocking. If real Ollama runs show length-truncated outputs, the fix is a safety factor (for example bytes/3, or 85% of the input budget).
2. **Low: config can change mid-run.** The config is read once before packing, but `generate` reads it again. If the profile is updated during a run so `structured_output` is removed, the run fails with `unsupported_capability`. If the context limit is shrunk, the packed prompt no longer matches the budget. This window is rare and the failure is clean.
3. **Low: gaps in test coverage.**
   - `test_structured_capability_..._chat_only_remains_valid` never tests the chat-only case. It should assert that `'format'` is absent from the request body for a chat-only profile.
   - Nothing tests the no-evidence schema (`maxItems:0`, no `enum`).
   - Nothing tests packing for the plan intent.
4. **Info: history can start with an orphan assistant answer.** If the budget admits an assistant answer but not the user turn before it, history begins with that answer. The old code behaved the same way, so this isn't a regression.

The live-acceptance timeouts aren't fixed by this commit, only made less likely because prompts are smaller. They still need separate tracking, as you said.

Next step: the integrator runs the full regression suite on `041901a`. Findings 1 and 3 go back to the author as optional follow-ups, and the coordinator decides whether to integrate.
