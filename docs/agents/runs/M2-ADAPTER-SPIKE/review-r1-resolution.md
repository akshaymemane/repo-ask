# Adapter R1 resolution

Review target9de6eeb received CHANGES REQUESTED; not approved.

- M1: public run now requires threading.Event and wraps the entire attempt with
  finally:set(). All valid Events close after success, validation/policy/auth/
  endpoint failures, spawn errors, parser failures and containment outcomes.
  Missing/invalid Event has stable invalid_stop_event. OSError and ValueError
  at the public boundary map to cli_unavailable and invalid_limits respectively.
- M2: earlier evidence is historical only. The previously submitted JSON is
  preserved byte-for-byte under historical/real-probe-pre-r1-manually-annotated.json,
  with its manual capability fields and unknown exact earlier source disclosed.
  The revised probe aborts unless every fingerprinted source file matches HEAD,
  records code_sha and SHA256 source hashes, checks source unchanged afterward,
  and writes generated JSON exactly once. Final evidence is pending a reserved run.
- m1: all three metadata queries use separate fresh0700empty working directories
  plus --setting-sources empty. No shared /tmp cwd remains.
- m2: prompt is no longer in argv. A bounded UTF8 prompt goes into an unnamed0600
  TemporaryFile passed directly as stdin; no pipe feeder thread exists.
- m3: when emitted by init, skills/custom agents/non-default output_style are
  rejected. Known builtin agent names are inert metadata under the exact tool
  inventory, which still excludes Agent/Task/Skill. Missing optional fields are
  not an attestation about future CLI schemas; no blanket future-default claim.
- m4: SessionService continues to map AdapterError.code; no duplicate result event
  is synthesized for exception paths.

31 focused boundary tests passed9.485s. Actual read-only CLI2.1.311 preflight
succeeded with the revised metadata command context. No model inference run yet
for this revision. Real coding/cancel/ask_user via stdin remains required before
requesting fresh exact-commit independent review.
