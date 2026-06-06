#!/usr/bin/env node
import 'zx/globals';
import updateNotifier from 'update-notifier';
import { createCommand } from 'commander';
import { description, version, name } from '../package.json';
import {
  getConfigJson,
  getRepoRoot,
  logger,
  skipEnvName,
  hooks,
} from './utils';

function isVerboseMode() {
  return Boolean(process.env.DEBUG);
}

// initialize zx
$.verbose = isVerboseMode();
$.cwd = await getRepoRoot();
$.env = { ...process.env, [skipEnvName]: 'true' };
// platform compatibility
path = path.posix;

const ensureConfigExit = async () => {
  try {
    await getConfigJson();
  } catch {
    logger.print('No configurations were found.');
    process.exit(0);
  }
};

const program = createCommand('lockfile');

program
  .version(version)
  .description(description)
  .showHelpAfterError('(add --help for additional information)')
  .hook('preAction', () => updateNotifier({ pkg: { name, version } }).notify());

program
  .command('install [path]')
  .description('Initialize configurations.')
  .option('-f,--force', 'Overwrite configurations if exist')
  .action((dir, options) =>
    import('./install').then((v) => v.default(dir, options.force)),
  );

program
  .command('merge')
  .argument('base', 'Base version %O')
  .argument('ours', 'Ours version %A')
  .argument('theirs', 'Theirs version %B')
  .argument('filename', 'Conflicting filename %P')
  .description('A custom merge driver used to merge file.')
  .hook('preAction', ensureConfigExit)
  .action((...args) =>
    // @ts-ignore
    import('./merge').then((v) => v.default(...args)),
  );

program
  .command('resolve')
  .description('Drop local changes on matched file and use theirs version.')
  .hook('preAction', ensureConfigExit)
  .action(() => import('./resolve').then((v) => v.default()));

program
  .command('hook')
  .argument('<name>', 'Pre-defined git hook name.')
  .description('Run lockfile-conflicts logic from a git hook.')
  .action((hookName: keyof typeof hooks) =>
    import('./hook').then((v) => v.default(hookName)),
  );

program
  .command('uninstall')
  .description('Remove githooks and relevant local git configs.')
  .option('-f,--force', 'Force run uninstall process.')
  .hook('preAction', async (cmd) => {
    if (!cmd.opts().force) {
      await ensureConfigExit();
    }
  })
  .action(() => import('./uninstall').then((v) => v.default()));

await program.parseAsync();
