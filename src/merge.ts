import { appendLogFile, printHints } from './utils';

export default async (
  base: string,
  ours: string,
  theirs: string,
  filename: string,
) => {
  $.verbose = false;

  // Accept theirs version
  await $`git merge-file --theirs ${base} ${ours} ${theirs}`;
  printHints(filename);

  appendLogFile(filename); // preserve log file
};
