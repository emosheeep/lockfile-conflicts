/** This file shouldn't depend on the others to avoid cycles */
export const getRepoRoot = async () =>
  (await $`git rev-parse --show-toplevel`).valueOf();

export const getGirAttributes = async () =>
  path.resolve(await getRepoRoot(), '.gitattributes');

export const getGitDirectory = async () =>
  (await $`git rev-parse --git-dir`).valueOf();

async function resolveRepoPath(value: string) {
  return path.isAbsolute(value)
    ? value
    : path.resolve(await getRepoRoot(), value);
}

export const getGitCommonDirectory = async () => {
  return resolveRepoPath((await $`git rev-parse --git-common-dir`).valueOf());
};

export const getRawHooksPath = async () => {
  const localHooksPath = await $`git config --local --path --get core.hooksPath`
    .quiet()
    .nothrow();
  if (localHooksPath.ok && localHooksPath.valueOf()) {
    return resolveRepoPath(localHooksPath.valueOf());
  }
  // Ignore global core.hooksPath here. Installing lockfile-conflicts is a
  // repository-scoped operation, so it must not mutate shared/global hooks.

  return path.join(await getGitCommonDirectory(), 'hooks');
};

function getHuskyShimTarget(rawHookPath: string, hookName: string) {
  const rawHookDir = path.dirname(rawHookPath);
  const huskyLauncher = path.join(rawHookDir, 'h');
  if (
    path.basename(rawHookDir) !== '_' ||
    !fs.existsSync(rawHookPath) ||
    !fs.existsSync(huskyLauncher)
  ) {
    return;
  }

  const rawHook = fs.readFileSync(rawHookPath, 'utf8');
  if (!rawHook.includes('/h') && !rawHook.includes('"h"')) {
    return;
  }

  // Husky v9 stores Git-executed shim hooks in `.husky/_/<hook>` and then
  // delegates to the user hook in `.husky/<hook>` through `.husky/_/h`.
  return path.join(path.dirname(rawHookDir), hookName);
}

export async function resolveHookTarget(hookName: string) {
  const rawHookPath = path.join(await getRawHooksPath(), hookName);
  const delegatedHookPath = getHuskyShimTarget(rawHookPath, hookName);
  const hookPath = delegatedHookPath || rawHookPath;

  return {
    hookPath,
    cleanupPaths: Array.from(new Set([rawHookPath, hookPath])),
  };
}

export const getCurrentBranch = async () =>
  (await $`git branch --show-current`).valueOf();

export const isMerging = async () =>
  fs.existsSync(path.resolve(await getGitDirectory(), 'MERGE_HEAD'));

export const isRebasing = async () =>
  fs.existsSync(path.resolve(await getGitDirectory(), 'rebase-merge'));
