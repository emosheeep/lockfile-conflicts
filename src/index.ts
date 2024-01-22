#!/usr/bin/env node
import 'zx/globals';
import updateNotifier from 'update-notifier';
import { createCommand } from 'commander';
import { description, version, name } from '../package.json';
import { getConfigJson, logger } from './utils';

path = path.posix; // platform compatibility

const ensureConfigExit = () => {
  try {
    getConfigJson();
  } catch (e) {
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
  .command('cleanup')
  .description('Clean log files and execute `runAfter` script if needed.')
  .option('--only', 'Remove temp files only.')
  .hook('preAction', ensureConfigExit)
  .action((options) =>
    import('./cleanup').then((v) => v.default(options.only)),
  );

program
  .command('uninstall')
  .description('Remove githooks and relevant local git configs.')
  .option('-f,--force', 'Force run uninstall process.')
  .hook('preAction', (cmd) => {
    !cmd.opts().force && ensureConfigExit();
  })
  .action(() => import('./uninstall').then((v) => v.default()));

program.parse();
