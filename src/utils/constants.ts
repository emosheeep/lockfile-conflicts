import { name } from '../../package.json';

export { name };

export const banner = [`# ${name} start`, `# ${name} end`];

export const defaultConfigDir = '.lockfile';
export const conflictFileName = 'logs/conflicts';
export const configFileName = 'config.json';

/** !!!This path is based on outDir(dist)!!! */
export const configURL = new URL('../config', import.meta.url);

export const skipEnvName = 'SKIP_LOCKFILE_HOOKS';

export const customDriver = 'lockfile merge %O %A %B %P';

export const hooks = {
  'pre-rebase': ['lockfile cleanup --only'],
  'post-commit': ['lockfile cleanup'],
  'post-rewrite': [
    `if [ "$1" = "rebase" ]; then`,
    '  lockfile cleanup;',
    'fi;',
  ],
};
