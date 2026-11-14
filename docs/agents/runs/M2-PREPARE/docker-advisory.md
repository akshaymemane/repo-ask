# Docker execution boundary advisory

Independent Codex `/root/review_index_foundation` tested Engine28.3.2 with cached
official debian:stable-slim image00959f189b92 and two temporary synthetic sessions.
Each could read/write only its mounted workspace; the other session, host sentinel,
host mount and Docker socket were absent. UID65534, effective capabilities0,
NoNewPrivs1, read-only root and no network routes were verified. Outbound connection
failed. Both owned sleeping containers stopped in0.186seconds and were confirmed
stopped; all created containers/directories were removed.

Flags: networknone, cap-dropALL, no-new-privileges, user65534:65534, read-only root,
/tmp tmpfs with nosuid/nodev/noexec and16MiB, pids64, memory/swap128MiB, CPU0.5,
nofile128, core0, init, one owned workspace bind mount, workdir/workspace, HOME/tmp.
Bind-mount disk usage still needs an independently enforced quota.

Claude Code2.1.311 exposes restricted mode, an empty builtin tool set and strict
MCP configuration. The proposed adapter runs the host harness with only trusted
MCP tools; that server pins its Docker target internally. Start the harness in a
trusted empty directory, disable hooks/skills, reject incompatible managed policy,
check the initialization tool inventory and avoid transcript persistence. Stop,
lease and budget checks belong outside the model. Stop must terminate both the
host harness process tree and the container. [Official CLI reference](https://code.claude.com/docs/en/cli-reference).

This probe did not run inference, read authentication files, download packages or
implement the adapter. MCP connectivity, real coding, event mapping and agent
cancellation still need the M2 spike. It is preparation evidence, not M2 acceptance.
