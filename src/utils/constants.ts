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

export const hooks = {
  'pre-rebase': ['lockfile hook pre-rebase || true'],
  'post-checkout': ['lockfile hook post-checkout || true'],
  'post-commit': ['lockfile hook post-commit || true'],
  'post-rewrite': [
    `if [ "$1" = "rebase" ]; then`,
    '  lockfile hook post-rewrite || true;',
    'fi;',
  ],
};
