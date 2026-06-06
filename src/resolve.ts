import { matcher } from 'matcher';
import {
  getConfigJson,
  isMerging,
  isRebasing,
  logger,
  printHints,
} from '@/utils';

export default async () => {
  if (!(await isMerging()) || !(await isRebasing())) {
    return logger.print('Not in a merge/rebase process?');
  }

  const { lockfilePattern } = await getConfigJson();

  const unmergedResult = (
    await $`git diff --name-only --diff-filter=U`
  ).valueOf();
  const matchedFiles = matcher(
    unmergedResult.split('\n').filter(Boolean),
    lockfilePattern,
  );

  for (const filename of matchedFiles) {
    printHints(filename);
    /** Discard local changes of lockfile to avoid breaking. */
    await $`git reset HEAD -- ${filename}`;
    await $`git restore ${filename}`;
  }
};
