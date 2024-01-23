import { exec } from 'child_process';
import { promisify } from 'util';
import { commitMessage as defaultCommitMessage } from '../config/config.json';
import {
  conflictFileName,
  execGitCommand,
  getConfigDir,
  getConfigJson,
  isMerging,
  isRebasing,
  logger,
  shouldSkipExec,
  splitFile,
} from '@/utils';

export default async (
  /** Remove temp flies only */
  only = false,
) => {
  if (shouldSkipExec()) return; // avoid loop
  /**
   * checkout in rebase/merge will trigger post-checkout,
   * which may cause temp files to be removed.
   * as a result, the `runAfter` script won't be executed after
   * the rebase is completed.
   */
  if (isMerging() || isRebasing()) return;

  const configDirPath = getConfigDir();
  const logFile = path.resolve(configDirPath, conflictFileName);
  const isLogFileExist = fs.existsSync(logFile);
  const conflictFiles = new Set(isLogFileExist ? splitFile(logFile) : []);
  execGitCommand(`git clean -Xf ${configDirPath}`); // cleanup ignored files.

  if (only || !conflictFiles.size) return;

  logger.info(`Note there're conflicts on lockfile before:`);
  conflictFiles.forEach((v) => logger.info(`→ ${v}`));
  logger.info(chalk.bold(`And we've accepted theirs version.`));

  const { runAfter, commitMessage = defaultCommitMessage } = getConfigJson();

  if (runAfter) {
    logger.info(
      `Now we need to execute configured ${chalk.underline('runAfter')} script to update it, please wait.`,
    );
    logger.info(
      chalk.bold(
        "This action won't affect commit result, just exit with",
        chalk.underline('Ctrl + C'),
        'if it runs unexpectedly.',
      ),
    );

    const [cmd, ...params] = runAfter.trim().split(' ');
    const displayedName = `${chalk.green(cmd)} ${params.join(' ')}`;

    try {
      await spinner(displayedName, () => promisify(exec)(runAfter));
    } catch (e: any) {
      console.log(e.stderr || e.stdout);
      return logger.error(
        chalk.bold(
          `Failed to run ${chalk.underline(e.cmd)} for some reasons, ` +
            'please manually make sure the lockfile is up-to-date.',
        ),
      );
    }

    let wasHit = false;
    for (const filename of conflictFiles) {
      if (execGitCommand(`git status -s ${filename}`)) {
        await $`git add ${filename}`;
        wasHit = true;
      }
    }
    if (wasHit) {
      await $`git commit -m ${commitMessage} --no-verify`;
      await $`git --no-pager log -1`.stdio('inherit', 'inherit');
      logger.info('Changes committed.');
    } else {
      logger.info('Nothing to commit.');
    }
  } else {
    logger.info(
      chalk.bold(
        `But you've not configured ${chalk.underline('runAfter')} script, ` +
          'please manually make sure the lockfile is up-to-date.',
      ),
    );
  }
};
