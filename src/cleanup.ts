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
  hooks,
} from '@/utils';

export default async (hook: keyof typeof hooks) => {
  if (shouldSkipExec()) return; // Avoid loop.

  const configDir = getConfigDir();
  if (!configDir) return; // Not initialized, exit.

  if (isMerging() || isRebasing()) {
    /**
     * 1. post-checkout
     * checkout in rebase/merge will trigger `post-checkout` hook, which cause
     * temp files to be removed. As a result, the `runAfter` script won't
     * be executed after the rebase/merge is completed.
     *
     * 2. post-commit
     * rebase process may create new commit which triggers post-commit hook, it
     * causes same problem list above.
     *
     * In conclusion, we should exit directly.
     */
    if (hook === 'post-checkout' || hook === 'post-commit') {
      return;
    }
  }

  const logFile = path.resolve(configDir, conflictFileName);
  const isLogFileExist = fs.existsSync(logFile);
  const conflictFiles = new Set(isLogFileExist ? splitFile(logFile) : []);

  execGitCommand(`git clean -Xf ${configDir}`); // Cleanup ignored files.

  if (!conflictFiles.size) return; // No conflicts, exit.

  // These hooks are only used to clean temp files, exit.
  if (hook === 'pre-rebase' || hook === 'post-checkout') return;

  logger.info(chalk.bold(`Note there're conflicts on lockfile before:`));
  conflictFiles.forEach((v) => logger.info(`${chalk.blue('→')} ${v}`));
  logger.info(chalk.bold(`And we've accepted theirs version.`));

  const { runAfter, commitMessage = defaultCommitMessage } = getConfigJson();

  if (runAfter) {
    logger.info(
      chalk.bold(
        `Now we need to execute configured ${chalk.underline('runAfter')}`,
        'script to update it, please wait.',
      ),
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
