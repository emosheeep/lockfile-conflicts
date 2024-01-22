import { GitConfig, getRepoRoot } from './git';
import {
  defaultConfigDir,
  conflictFileName,
  configFileName,
  gitConfigKey,
} from './constants';

export interface ConfigJson {
  commitMessage: string;
  runAfter: string;
  lockfilePattern: string;
}

export const mergeDriver = new GitConfig(gitConfigKey.mergeDriver);
export const configDir = new GitConfig(
  gitConfigKey.configDir,
  defaultConfigDir,
);

export function appendConflictFile(filename: string) {
  const filePath = path.resolve(getConfigDir(), conflictFileName);
  if (!fs.existsSync(filePath)) {
    fs.ensureFileSync(filePath);
    fs.writeFileSync(filePath, filename);
  } else {
    fs.appendFileSync(filePath, `\n${filename}`);
  }
}

export function getConfigDir() {
  return path.resolve(getRepoRoot(), configDir.get());
}

export function getConfigJson() {
  return fs.readJsonSync(
    path.resolve(getConfigDir(), configFileName),
  ) as ConfigJson;
}
