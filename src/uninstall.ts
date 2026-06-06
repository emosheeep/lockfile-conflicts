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
  await uninstallHooks();

  // remove merge strategy
  await removeGitAttributes();

  const configDir = await getConfigDir();

  // reset git config
  await removeGitConfig();

  // remove config directory
  fs.rmSync(configDir!, { recursive: true, force: true });

  logger.success(`${name} has been removed.`);
};
