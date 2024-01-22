/** This file shouldn't depend on the others to avoid cycles */
import { name } from '../../package.json';

export { name };

export const banner = [`# ${name} start`, `# ${name} end`];

export const defaultConfigDir = '.lockfile';
export const conflictFileName = 'temp/conflicts';
export const configFileName = 'config.json';

export const gitConfigKey = {
  configDir: `${name}.configDir`,
  mergeDriver: `merge.${name}.driver`,
};

/** !!!This path is based on outDir(dist)!!! */
export const configURL = new URL('../config', import.meta.url);

export const skipEnvName = 'SKIP_LOCKFILE_HOOKS';

export const shellBaseDir = `cd $(dirname $(git rev-parse --show-toplevel)/$(git config ${gitConfigKey.configDir}))`;

export const customDriver = `${shellBaseDir} && npx lockfile merge %O %A %B %P`;

export const hooks = {
  'pre-rebase': ['npx lockfile cleanup --only'],
  'post-checkout': ['npx lockfile cleanup --only'],
  'post-commit': ['npx lockfile cleanup'],
  'post-rewrite': [
    `if [ "$1" = "rebase" ]; then`,
    '  npx lockfile cleanup;',
    'fi;',
  ],
};
