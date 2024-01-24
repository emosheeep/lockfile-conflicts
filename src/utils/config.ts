import { execGitCommand, getRepoRoot } from './git';
import {
  conflictFileName,
  configFileName,
  gitConfigKey,
  name,
  defaultConfigDir,
} from './constants';

export interface ConfigJson {
  commitMessage: string;
  runAfter: string;
  lockfilePattern: string;
}

export function appendConflictFile(filename: string) {
  const configDir = getConfigDir();
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
export function getConfigDir() {
  const configDir = getGitConfig(gitConfigKey.configDir);
  if (configDir) {
    return path.resolve(getRepoRoot(), configDir);
  }
}

export function getRelBinDir(configDir = getConfigDir()) {
  const repoRoot = getRepoRoot();
  // Should be installed in the same directory as node_modules
  return path.relative(
    repoRoot,
    path.join(
      configDir ? path.dirname(configDir) : repoRoot,
      'node_modules/.bin',
    ),
  );
}

export function getConfigJson() {
  return fs.readJsonSync(
    path.resolve(getConfigDir()!, configFileName),
  ) as ConfigJson;
}

export function getGitConfig(key: string): string {
  try {
    return execGitCommand(`git config --local ${key}`);
  } catch (error) {
    return '';
  }
}

export function setGitConfig({ configDir }: { configDir: string }) {
  for (const [key, value] of [
    [gitConfigKey.configDir, configDir || defaultConfigDir],
    [
      gitConfigKey.mergeDriver,
      `${path.join(getRelBinDir(configDir), 'lockfile')} merge %O %A %B %P`,
    ],
  ]) {
    execGitCommand(`git config --local ${key} "${value}"`);
  }
}

export function removeGitConfig() {
  try {
    const reset = (key: string) =>
      execGitCommand(`git config --local --unset ${key}`);
    // remove known config
    Object.values(gitConfigKey).forEach((key) => reset(key));
    // remove possible legacy config
    const stdout = execGitCommand(`git config --get-regexp "^${name}"`);
    for (const item of stdout.split('\n').filter(Boolean)) {
      const [configName] = item.split(' ');
      reset(configName);
    }
  } catch (e) {}
}
