import { commitMessage as defaultCommitMessage } from '../config/config.json';
import { runAfterCommand } from './run-after';
import {
  conflictFileName,
  getConfigDir,
  getConfigJson,
  isMerging,
  isRebasing,
  logger,
  shouldSkipExec,
  splitFile,
  hooks,
} from '@/utils';

async function cleanIgnoredFiles(configDir: string) {
  await $`git clean -Xfd ${configDir}`; // Cleanup ignored files/directories.
}

export default async (hook: keyof typeof hooks) => {
  if (shouldSkipExec()) return; // Avoid loop.

  const configDir = await getConfigDir();
  if (!configDir) return; // Not initialized, exit.

  if ((await isMerging()) || (await isRebasing())) {
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

  await cleanIgnoredFiles(configDir);

  if (!conflictFiles.size) return; // No conflicts, exit.

  // These hooks are only used to clean temp files, exit.
  if (hook === 'pre-rebase' || hook === 'post-checkout') return;

  logger.info(
    chalk.bold(
      `Note there were conflicts on lockfile before and we accepted theirs version:`,
    ),
  );
  conflictFiles.forEach((v) => logger.info(`${chalk.blue('→')} ${v}`));

  const { runAfter, commitMessage = defaultCommitMessage } =
    await getConfigJson();

  if (runAfter) {
    logger.info(
      chalk.bold(
        `Executing configured ${chalk.underline('runAfter')} command, please wait.`,
      ),
      chalk.bold(
        'This operation has no side effects and can be safely quit with',
        `${chalk.underline('Ctrl + C')} if it runs unexpected.`,
      ),
    );

    let wasInterrupted = false;
    const markInterrupted = () => {
      wasInterrupted = true;
    };

    process.once('SIGINT', markInterrupted);
    process.once('SIGTERM', markInterrupted);

    try {
      const [cmd, ...params] = runAfter.trim().split(' ');
      logger.info(`$ ${chalk.green(cmd)} ${params.join(' ')}`);

      runAfterCommand(runAfter);
    } catch (e: any) {
      const output = e.stderr || e.stdout;
      if (output) {
        console.log(output);
      }
      const failedCommand = e.cmd || runAfter;
      const reason = e.signal
        ? `signal ${e.signal}`
        : wasInterrupted
          ? 'interrupted'
          : `exit code ${e.status}`;
      return logger.error(
        chalk.bold(
          `Failed to run ${chalk.underline(failedCommand)} (${reason}), ` +
            'please manually make sure the lockfile is up-to-date.',
        ),
      );
    } finally {
      await cleanIgnoredFiles(configDir);

      process.removeListener('SIGINT', markInterrupted);
      process.removeListener('SIGTERM', markInterrupted);
    }

    let wasHit = false;
    for (const filename of conflictFiles) {
      if ((await $`git status -s ${filename}`).valueOf()) {
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
