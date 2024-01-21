import { name } from '../../package.json';

export { name };

export const banner = [`# ${name} start`, `# ${name} end`];

export const defaultConfigDir = '.lockfile';

/** !!!This path is based on outDir(dist)!!! */
export const configURL = new URL('../config', import.meta.url);

export const skipEnvName = 'SKIP_LOCKFILE_HOOKS';

export const customDriver = 'lockfile merge %O %A %B %P';

export const hooks = {
  'post-commit': [
    `if [ "$${skipEnvName}" != "true" ]; then`,
    '  lockfile cleanup;',
    'fi;',
  ],
  'post-rewrite': [
    `if [ "$1" = "rebase" && "$${skipEnvName}" != "true" ]; then`,
    '  lockfile rebase;',
    'fi;',
  ],
};
