# lockfile-conflicts

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
