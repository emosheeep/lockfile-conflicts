import { isMatch } from 'matcher';
import debug from 'debug';
import {
  appendLogFile,
  execGitCommand,
  getConfigJson,
  partition,
  printHints,
} from './utils';

const print = debug('rebase');

export const getUnmergedFiles = () => {
  const unmergedResult = execGitCommand(`git diff --name-only --diff-filter=U`);
  return unmergedResult.split('\n').filter(Boolean);
};

/** Discard local changes of lockfile to avoid breaking. */
export const handleLockfileConflicts = (filename: string) => {
  execGitCommand(`git reset HEAD -- ${filename}`);
  execGitCommand(`git restore ${filename}`);
  appendLogFile(filename);
};

export default async () => {
  const { lockfilePattern } = getConfigJson();

  const [matchedFiles, otherFiles] = partition(getUnmergedFiles(), (name) =>
    isMatch(name, lockfilePattern),
  );

  print('matched', matchedFiles);
  print('other', otherFiles);

  for (const filename of matchedFiles) {
    printHints(filename);
    handleLockfileConflicts(filename);
  }

  if (!otherFiles.length) {
    const stdout = execGitCommand(`git diff --name-only HEAD`);
    execGitCommand(`git rebase ${stdout ? '--continue' : '--skip'}`);
  }

  // await import('./cleanup').then((v) => v.default());
};
