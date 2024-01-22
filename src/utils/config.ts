import { GitConfig, getRepoRoot } from './git';
import {
  name,
  defaultConfigDir,
  conflictFileName,
  configFileName,
} from './constants';

export interface ConfigJson {
  commitMessage: string;
  runAfter: string;
  lockfilePattern: string;
}

export const configDir = new GitConfig(`${name}.configDir`, defaultConfigDir);
export const mergeDriver = new GitConfig(`merge.${name}.driver`);

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
