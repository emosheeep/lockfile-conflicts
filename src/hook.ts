import cleanup from './cleanup';
import { configFileName, getConfigDir, hooks, logger, name } from '@/utils';

export default async (hook: keyof typeof hooks) => {
  const configDir = await getConfigDir();
  if (!configDir || !fs.existsSync(path.resolve(configDir, configFileName))) {
    logger.info(`${name}: config not found, skip hook cleanup.`);
    return;
  }

  try {
    await cleanup(hook);
  } catch (error: any) {
    logger.error(
      error?.message ||
        `${name}: hook cleanup failed, please manually make sure the lockfile is up-to-date.`,
    );
  }
};
