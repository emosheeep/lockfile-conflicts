import { exec } from 'child_process';
import { promisify } from 'util';
import { commitMessage as defaultCommitMessage } from '../config/config.json';
import {
  conflictFileName,
  execGitCommand,
  getConfigDir,
  getConfigJson,
  getGitDirectory,
  isWorkingDirClean,
  logger,
  shouldSkipExec,
  skipEnvName,
  splitFile,
} from '@/utils';

const isMerging = () =>
  fs.existsSync(path.resolve(getGitDirectory(), 'MERGE_HEAD'));

const isRebasing = () => {
  const gitdir = getGitDirectory();
  return ['rebase-apply', 'rebase-merge'].some((v) =>
    fs.existsSync(path.resolve(gitdir, v)),
  );
};

export default async (
  /** Remove temp flies only */
  only = false,
) => {
  if (shouldSkipExec()) return; // avoid loop
  if (isMerging() || isRebasing()) return; // avoid unexpected modifications

  const configDirPath = getConfigDir();
  const logFile = path.resolve(configDirPath, conflictFileName);
  const isLogFileExist = fs.existsSync(logFile);
  const conflictFiles = new Set(isLogFileExist ? splitFile(logFile) : []);
  execGitCommand(`git clean -Xf ${configDirPath}`); // cleanup ignored files.

  if (only || !conflictFiles.size) return;

  logger.info(`Note there're conflicts on lockfile before:`);
  conflictFiles.forEach((v) => logger.print(`→ ${v}`));

  const { runAfter, commitMessage = defaultCommitMessage } = getConfigJson();

  if (runAfter) {
    logger.info(
      `And you've configured ${chalk.underline('runAfter')} script, ` +
        'please wait to update.',
    );

    const [cmd, ...params] = runAfter.trim().split(' ');
    const displayedName = `${chalk.green(cmd)} ${params.join(' ')}`;

    try {
      await spinner(displayedName, () => promisify(exec)(runAfter));
    } catch (e: any) {
      console.log(e.stderr || e.stdout);
      return logger.error(
        chalk.bold(
          `Failed to run ${chalk.underline(e.cmd)} for reasons, ` +
            'please make sure the lockfile is up-to-date.',
        ),
      );
    }

    // avoid git hook loop
    $.env = { ...process.env, [skipEnvName]: 'true' };

    if (!isWorkingDirClean()) {
      for (const filename of conflictFiles) {
        await $`git add ${filename}`;
      }
      await $`git commit -m ${commitMessage} --no-verify`;
    } else {
      logger.info('Working directory is clean, nothing to commit.');
    }
  } else {
    logger.warn(
      `But no ${chalk.underline('runAfter')} script was configured, ` +
        chalk.bold('please make sure the lockfile is up-to-date.'),
    );
  }
};
