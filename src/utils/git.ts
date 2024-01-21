import { execSync } from 'child_process';
import debug from 'debug';

const printGitCommand = debug('git');

export class GitConfig {
  #key: string;
  #defaultValue: string;

  constructor(key: string, defaultValue?: string) {
    this.#key = key;
    this.#defaultValue = defaultValue ?? '';
  }

  execute(cmd: string) {
    try {
      // Access a non-exist config will exitWith non-zero.
      return execGitCommand(cmd);
    } catch (e) {
      return '';
    }
  }

  get() {
    return (
      this.execute(`git config --local ${this.#key}`) || this.#defaultValue
    );
  }

  set(value: string) {
    execGitCommand(`git config --local ${this.#key} "${value}"`);
  }

  unset() {
    this.execute(`git config --local --unset ${this.#key}`);
  }
}

export const execGitCommand = (command: string) => {
  printGitCommand(command);
  return execSync(command, { encoding: 'utf8' }).trim();
};

export const getRepoRoot = () =>
  execGitCommand('git rev-parse --show-toplevel');

export const getGirAttributes = () =>
  path.resolve(getRepoRoot(), '.gitattributes');

export const getGitDirectory = () => execGitCommand('git rev-parse --git-dir');

export const isWorkingDirClean = () => !execGitCommand('git status -s');

export const getHooksPath = () =>
  path.resolve(
    getRepoRoot(),
    execGitCommand('git config --local core.hooksPath') || '.git/hooks',
  );

export const getCurrentBranch = () =>
  execGitCommand('git branch --show-current');
