import { getRepoRoot } from './git';
import {
  conflictFileName,
  configFileName,
  gitConfigKey,
  name,
  defaultConfigDir,
} from './constants';

export interface ConfigJson {
  commitMessage?: string;
  runAfter: string;
  lockfilePattern: string;
}

export async function appendConflictFile(filename: string) {
  const configDir = await getConfigDir();
  if (!configDir) return;
  const filePath = path.resolve(configDir, conflictFileName);
  if (!fs.existsSync(filePath)) {
    fs.ensureFileSync(filePath);
    fs.writeFileSync(filePath, filename);
  } else {
    fs.appendFileSync(filePath, `\n${filename}`);
  }
}

/** Get absolute path of configDir */
export async function getConfigDir() {
  const configDir = await getGitConfig(gitConfigKey.configDir);
  if (configDir) {
    return path.resolve(await getRepoRoot(), configDir);
  }
}

export async function getRelBinDir(configDir?: string) {
  configDir ??= await getConfigDir();
  const repoRoot = await getRepoRoot();
  // Should be installed in the same directory as node_modules
  return path.relative(
    repoRoot,
    path.join(
      configDir ? path.dirname(configDir) : repoRoot,
      'node_modules/.bin',
    ),
  );
}

export async function getConfigJson() {
  return fs.readJsonSync(
    path.resolve((await getConfigDir())!, configFileName),
  ) as ConfigJson;
}

export async function getGitConfig(key: string): Promise<string> {
  const output = await $`git config --local ${key}`.quiet().nothrow();
  return output.ok ? output.valueOf() : '';
}

export async function setGitConfig({ configDir }: { configDir: string }) {
  for (const [key, value] of [
    [gitConfigKey.configDir, configDir || defaultConfigDir],
    [
      gitConfigKey.mergeDriver,
      `${path.join(await getRelBinDir(configDir), 'lockfile')} merge %O %A %B %P`,
    ],
  ]) {
    await $`git config --local ${key} ${value}`;
  }
}

export async function removeGitConfig() {
  const reset = (key: string) =>
    $`git config --local --unset ${key}`.quiet().nothrow();

  // remove known config
  for (const key of Object.values(gitConfigKey)) {
    await reset(key);
  }

  // remove possible legacy config
  const legacyConfig = await $`git config --get-regexp ${`^${name}`}`
    .quiet()
    .nothrow();
  if (!legacyConfig.ok) return;

  for (const item of legacyConfig.valueOf().split('\n').filter(Boolean)) {
    const [configName] = item.split(' ');
    await reset(configName);
  }
}
