import debug from 'debug';
import {
  configDir,
  getRepoRoot,
  logger,
  mergeDriver,
  injectGitAttributes,
  configURL,
  customDriver,
  defaultConfigDir,
  name,
  injectShellScript,
  forEachHooks,
} from '@/utils';

const print = debug('install');

export default async (dir: string = '') => {
  $.verbose = false;

  try {
    // save config folder path
    const repoRoot = await getRepoRoot();
    const installedDir = configDir.get();
    const resolvedPath = dir
      ? path.resolve(process.cwd(), dir)
      : path.resolve(repoRoot, defaultConfigDir);

    const relativePath = path.relative(repoRoot, resolvedPath) || '.';

    print(`received path - ${dir}`);
    print(`installed dir - ${installedDir}`);
    print(`resolved path - ${resolvedPath}`);
    print(`relative path - ${relativePath}`);
    print(`config path - ${configURL}`);

    configDir.set(relativePath);

    // Write files
    if (!fs.existsSync(resolvedPath)) {
      if (fs.existsSync(installedDir)) {
        fs.moveSync(installedDir, resolvedPath, { overwrite: true });
        logger.info(
          `Configurations has been moved to ${chalk.underline(relativePath)}.`,
        );
      } else {
        fs.cpSync(configURL, resolvedPath, { recursive: true });
      }
    }

    // add git hooks
    forEachHooks((filename, scripts) => {
      injectShellScript(filename, scripts);
      fs.chmodSync(filename, '755'); // make file executable.
    });

    // add custom merge strategy
    mergeDriver.set(customDriver);
    injectGitAttributes();

    logger.success(`${name} installed.`);
  } catch (e: any) {
    console.log(e.stderr || e.message);
    return logger.error('Failed to initialize.');
  }
};
