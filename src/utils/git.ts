/** This file shouldn't depend on the others to avoid cycles */
import debug from 'debug';
import { execSync } from 'child_process';

const printGitCommand = debug('git');

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
