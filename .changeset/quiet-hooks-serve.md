---
"lockfile-conflicts": patch
---

Guard generated Git hooks before running `lockfile cleanup`, avoid mutating global hooks while supporting hook-manager shim directories and shared worktree hooks, and migrate the project toolchain to pnpm 11, Oxlint, and Oxfmt.
