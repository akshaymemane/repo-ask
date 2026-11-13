# ADR0002 — Local sqlite-vec with isolated APSW database

Status: Accepted after measured spike | Scope: F02 | Date:2026-11-13

Keep metadata, source text and FTS in the standard-library Store. Use APSW and sqlite-vec
for a separate private vectors.sqlite3. This host's Python3.12 sqlite3 lacks
`enable_load_extension`; requiring that method would break the actual target environment.
APSW bundles an isolated SQLite build and supports extension loading without replacing
stdlib SQLite or changing global Python installations.

Measured with projectvenv: APSW3.54.1.0 (SQLite3.54.1), sqlite-vec0.1.9. Loaded extension,
disabled further extension loading, inserted/query-tested vectors. A cosine-KNN query
filtered by snapshot_id returned only the authorized snapshot despite a closer excluded
vector. Do not run unrestricted KNN then post-filter unauthorized sources.

Store vector rows/cache by repository, snapshot and immutable namespace. Persist vector
staging first; activate the metadata snapshot only after required consistency checks.
Crash recovery repairs or discards unactivated staging. No cross-database transaction is
claimed. Unavailable vector support degrades explicitly to FTS; never fake semantic scores.

Dependencies are optional product extras, installed in the local projectvenv. Public wheel
SHA256 for downloaded crypto/APSW artifacts was checked against PyPI release metadata.
The development lock records this tested platform; it is not a universal wheel lock.

References: [APSW installation](https://rogerbinns.github.io/apsw/install.html),
[sqlite-vec Python](https://alexgarcia.xyz/sqlite-vec/python.html).
