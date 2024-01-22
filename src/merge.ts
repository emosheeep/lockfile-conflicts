import { appendConflictFile, execGitCommand, printHints } from './utils';

export default (
  base: string,
  ours: string,
  theirs: string,
  filename: string,
) => {
  // Accept theirs version
  execGitCommand(`git merge-file --theirs ${base} ${ours} ${theirs}`);
  // preserve log file
  appendConflictFile(filename);
  printHints(filename);
};
