#!/usr/bin/env node
import 'zx/globals';
import updateNotifier from 'update-notifier';
import { createCommand } from 'commander';
import { description, version, name } from '../package.json';
import { getConfigDir, logger } from './utils';

path = path.posix; // platform compatibility

const ensureConfigExit = () => {
  if (!fs.existsSync(getConfigDir())) {
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
  .action((arg) => import('./install').then((v) => v.default(arg)));

program
  .command('merge')
  .argument('base', 'base version')
  .argument('ours', 'ours version')
  .argument('theirs', 'theirs version')
  .argument('filename', 'conflicting filename')
  .description('Drop local changes on matched file and use theirs version.')
  .hook('preAction', ensureConfigExit)
  .action((...args) =>
    // @ts-ignore
    import('./merge').then((v) => v.default(...args)),
  );

program
  .command('rebase')
  .description('Drop local changes on matched file and use theirs version.')
  .hook('preAction', ensureConfigExit)
  .action(() => import('./rebase').then((v) => v.default()));

program
  .command('cleanup')
  .description('Clean log files and run configured commands if needed.')
  .hook('preAction', ensureConfigExit)
  .action(() => import('./cleanup').then((v) => v.default()));

program
  .command('uninstall')
  .description('Remove githooks and relevant local git configs.')
  .hook('preAction', ensureConfigExit)
  .action(() => import('./uninstall').then((v) => v.default()));

program.parse();
