import { matcher } from 'matcher';
import { execGitCommand, getConfigJson, printHints } from '@/utils';

export default () => {
  const { lockfilePattern } = getConfigJson();

  const unmergedResult = execGitCommand(`git diff --name-only --diff-filter=U`);
  const matchedFiles = matcher(
    unmergedResult.split('\n').filter(Boolean),
    lockfilePattern,
  );

  for (const filename of matchedFiles) {
    printHints(filename);
    /** Discard local changes of lockfile to avoid breaking. */
    execGitCommand(`git reset HEAD -- ${filename}`);
    execGitCommand(`git restore ${filename}`);
  }
};
