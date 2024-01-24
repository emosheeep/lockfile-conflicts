import {
  uninstallHooks,
  removeGitAttributes,
  logger,
  name,
  removeGitConfig,
  getConfigDir,
} from '@/utils';

export default async () => {
  // remove git hooks
  uninstallHooks();

  // remove merge strategy
  removeGitAttributes();

  const configDir = getConfigDir();

  // reset git config
  removeGitConfig();

  // remove config directory
  fs.rmSync(configDir!, { recursive: true, force: true });

  logger.success(`${name} has been removed.`);
};
