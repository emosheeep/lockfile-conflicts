# lockfile-conflicts

## 0.5.2

### Patch Changes

- Improve interrupted `runAfter` reporting so Ctrl+C displays as `interrupted` instead of `exit code 130`.
- Stop lingering `runAfter` process groups after Ctrl+C so command output does not continue after Git rebase completes.

## 0.5.1

### Patch Changes

- Repair packaged foreground helper executable permissions at runtime, falling back to direct `runAfter` execution if the helper cannot be made executable.

## 0.5.0

### Minor Changes

- Add a native foreground helper so Ctrl+C during `runAfter` does not interrupt an in-progress Git rebase.
- Make hook cleanup resilient when `runAfter` or lockfile hook execution fails, avoiding stale Git rebase state.
- Package foreground helper binaries for common Linux and macOS targets and fall back to the previous direct execution path when no helper is available.
- Add a timestamped test-publish workflow for alpha/beta/next prereleases.
- Simplify generated hook injection so it only prepends the local bin directory to find `lockfile`; runAfter keeps using the user's normal environment.

## 0.4.0

### Minor Changes

- 7f97c67: Guard generated Git hooks before running `lockfile cleanup`, avoid mutating global hooks while supporting hook-manager shim directories and shared worktree hooks, and migrate the project toolchain to pnpm 11, Oxlint, and Oxfmt.

## 0.3.0

### Minor Changes

- feat: use inherit stdio to print command log instead of spinner

## 0.2.1

### Patch Changes

- 0c2ec1e: feat: just hook stage in cleanup to avoid mis executing.
  chore: use local installed package first.

## 0.2.0

### Minor Changes

- 3448c0b: chore: refactor initialization process
  - use bin instead of npx command
  - remove git config first before set
  - add config directory exist judge logic

## 0.1.1

### Patch Changes

- d709810: chore: add missing .gitignore file

## 0.1.0

### Minor Changes

- 9b35b61: feat: first release.
