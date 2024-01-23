import debug from 'debug';
import { execSync } from 'child_process';
import { name, gitConfigKey } from './constants';

const printGitCommand = debug('git');

export class GitConfig {
  #key: string;
  #defaultValue: string;

  static execute(cmd: string) {
    try {
      // Access a non-exist config will exitWith non-zero.
      return execGitCommand(cmd);
    } catch (e) {
      return '';
    }
  }

  static reset(key: string) {
    GitConfig.execute(`git config --local --unset ${key}`);
  }

  static resetAll() {
    try {
      // remove known config
      Object.values(gitConfigKey).forEach((key) => GitConfig.reset(key));
      // remove possible legacy config
      const stdout = GitConfig.execute(`git config --get-regexp "^${name}"`);
      for (const item of stdout.split('\n').filter(Boolean)) {
        const [configName] = item.split(' ');
        GitConfig.reset(configName);
      }
    } catch (e) {}
  }

  constructor(key: string, defaultValue?: string) {
    this.#key = key;
    this.#defaultValue = defaultValue ?? '';
  }

  get() {
    return (
      GitConfig.execute(`git config --local ${this.#key}`) || this.#defaultValue
    );
  }

  set(value: string) {
    GitConfig.execute(`git config --local ${this.#key} "${value}"`);
  }

  unset() {
    GitConfig.reset(this.#key);
  }
}

export const getRepoRoot = () =>
  execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

export const execGitCommand = (command: string) => {
  printGitCommand(command);
  return execSync(command, { encoding: 'utf8', cwd: getRepoRoot() }).trim();
};

export const getGirAttributes = () =>
  path.resolve(getRepoRoot(), '.gitattributes');

export const getGitDirectory = () => execGitCommand('git rev-parse --git-dir');

export const getHooksPath = () =>
  path.resolve(
    getRepoRoot(),
    execGitCommand('git config --local core.hooksPath') || '.git/hooks',
  );

export const getCurrentBranch = () =>
  execGitCommand('git branch --show-current');

export const isMerging = () =>
  fs.existsSync(path.resolve(getGitDirectory(), 'MERGE_HEAD'));

export const isRebasing = () => {
  const gitdir = getGitDirectory();
  return ['rebase-apply', 'rebase-merge'].some((v) =>
    fs.existsSync(path.resolve(gitdir, v)),
  );
};
