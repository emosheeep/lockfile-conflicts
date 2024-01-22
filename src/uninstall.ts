import {
  configDir,
  mergeDriver,
  forEachHooks,
  replaceShellScript,
  removeGitAttributes,
  logger,
  name,
} from '@/utils';

export default async () => {
  // remove git hooks
  forEachHooks((filename) => {
    if (fs.existsSync(filename)) {
      replaceShellScript(filename, '');
    }
  });

  // remove merge strategy
  mergeDriver.unset();
  removeGitAttributes();

  // remove config directory
  const configDirPath = configDir.get();
  configDir.unset();
  fs.rmSync(configDirPath, { recursive: true, force: true });

  logger.success(`${name} has been removed.`);
};
