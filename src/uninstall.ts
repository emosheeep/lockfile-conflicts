import {
  configDir,
  forEachHooks,
  replaceShellScript,
  removeGitAttributes,
  logger,
  name,
  GitConfig,
} from '@/utils';

export default async () => {
  // remove git hooks
  forEachHooks((filename) => {
    if (fs.existsSync(filename)) {
      replaceShellScript(filename, '');
    }
  });

  // remove merge strategy
  removeGitAttributes();

  // remove config directory
  const configDirPath = configDir.get();
  fs.rmSync(configDirPath, { recursive: true, force: true });

  // reset git config
  GitConfig.resetAll();

  logger.success(`${name} has been removed.`);
};