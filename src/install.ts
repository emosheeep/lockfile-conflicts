import debug from 'debug';
import {
  getRepoRoot,
  logger,
  injectGitAttributes,
  configURL,
  defaultConfigDir,
  name,
  installHooks,
  setGitConfig,
  getConfigDir,
  removeGitConfig,
} from '@/utils';

const print = debug('install');

/** target dir should exist and not empty */
function isPathAvailable(target: string) {
  return fs.existsSync(target) && !!fs.readdirSync(target).length;
}
function isSameDirectory(source: string, target: string) {
  return path.resolve(source) === path.resolve(target);
}

export default async (dir: string = '', force = false) => {
  $.verbose = false;

  try {
    // save config folder path
    const repoRoot = await getRepoRoot();
    const installedDir = getConfigDir();

    const resolvedPath = path.resolve(process.cwd(), dir || defaultConfigDir);
    const relativePath = path.relative(repoRoot, resolvedPath) || '.';

    print(`received path - ${dir}`);
    print(`installed dir - ${installedDir}`);
    print(`resolved path - ${resolvedPath}`);
    print(`relative path - ${relativePath}`);
    print(`config path - ${configURL}`);

    // Write files
    if (!isPathAvailable(resolvedPath) || force) {
      if (
        installedDir &&
        isPathAvailable(installedDir) &&
        !isSameDirectory(resolvedPath, installedDir)
      ) {
        fs.moveSync(installedDir, resolvedPath, { overwrite: true });
        logger.info(
          `Configurations has been moved to ${chalk.underline(relativePath)}.`,
        );
      } else {
        fs.cpSync(configURL, resolvedPath, { recursive: true });
      }
    } else {
      logger.info(`${relativePath} exist`);
    }

    // git config should be applied after config dir has been set to avoid side effects
    removeGitConfig(); // remove first
    setGitConfig({ configDir: relativePath });

    // add git hooks
    installHooks();

    // add custom merge strategy
    injectGitAttributes();

    logger.success(`${name}${force ? ' force' : ''} installed.`);
  } catch (e: any) {
    console.log(e.stderr || e.message);
    e.stack && print(e.stack);
    logger.error(`Failed to initialize, try ${chalk.blue('--force')} option.`);
  }
};
