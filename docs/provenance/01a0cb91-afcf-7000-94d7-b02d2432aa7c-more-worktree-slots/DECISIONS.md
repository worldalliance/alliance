# Decisions

- **Cap of 246.** Slot n adds n \* 100 to each base port, so slot 246's highest port is 8085 + 24600 = 32685. It stays below 32768, where Linux's ephemeral range starts; macOS starts at 49152. Ports in the ephemeral range can be taken by outgoing connections, so a dev server could fail to bind now and then.
- **No port collisions at any slot.** The service ports end in 05, 73, 74 and 85, and the agentic-workflows panel's 6900 ends in 00, so no two can ever match. None of them is a port that browsers block.
- **Postgres and memory are the practical limits, not ports.** Local Postgres defaults to 100 connections, and each server's pool can open up to 10. That is a machine setting, so it is left out of the repo.
- **Old design note left alone.** `01a0c5ec-…-agentic-workflows-panel/DECISIONS.md` still gives the port ranges for slots 0 to 12. It records what was true when it was written.
