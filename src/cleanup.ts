import { exec } from 'child_process';
import { promisify } from 'util';
import {
  configDir,
  execGitCommand,
  getConfigJson,
  isWorkingDirClean,
  logger,
} from '@/utils';
import { commitMessage as defaultCommitMessage } from '../config/config.json';

async function isMergeCommit() {
  return (
    // A merge commit has grater than 2 parent lines at least.
    parseInt(
      execGitCommand(
        `git rev-parse HEAD | xargs git cat-file -p | grep ^parent | wc -l`,
      ),
    ) >= 2
  );
}

export default async () => {
  const configDirPath = configDir.get();
  const logFile = path.resolve(configDirPath, 'logs/conflicts');
  const isLogFileExist = fs.existsSync(logFile);
  const conflictFiles = new Set(
    isLogFileExist ? fs.readFileSync(logFile, 'utf-8').trim().split('\n') : [],
  );

  fs.rmSync(logFile, { recursive: true, force: true }); // cleanup

  if (!(await isMergeCommit()) || !conflictFiles.size) return; // Attention loop

  const { runAfter, commitMessage = defaultCommitMessage } = getConfigJson();

  if (runAfter) {
    logger.info(
      "Note there're conflicts on lockfile before and " +
        `you've configured ${chalk.underline('runAfter')} script, ` +
        'running to update, please wait.',
    );

    const [cmd, ...params] = runAfter.trim().split(' ');
    const displayedName = `${chalk.green(cmd)} ${params.join(' ')}`;
    await spinner(displayedName, () => promisify(exec)(runAfter));

    if (!isWorkingDirClean()) {
      for (const filename of conflictFiles) {
        await $`git add ${filename}`;
      }
      await $`git commit -nm ${commitMessage}`;
    } else {
      logger.info('Working directory is clean, nothing to commit.');
    }
  } else {
    logger.warn(
      `Note there're conflicts on lockfile before ` +
        `but no ${chalk.underline('runAfter')} script was configured, ` +
        chalk.bold('please make sure the lockfile is up-to-date.'),
    );
  }
};
