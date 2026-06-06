import { appendConflictFile, printHints } from './utils';

export default async (
  base: string,
  ours: string,
  theirs: string,
  filename: string,
) => {
  // Accept theirs version
  await $`git merge-file --theirs ${base} ${ours} ${theirs}`;
  // preserve log file
  await appendConflictFile(filename);
  printHints(filename);
};
