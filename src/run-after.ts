import { execFileSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';

export const foregroundHelperEnvName = 'LOCKFILE_FOREGROUND_HELPER';

function packageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function linuxLibcSuffix() {
  if (process.platform !== 'linux') return '';
  const report = process.report?.getReport?.() as
    | { header?: { glibcVersionRuntime?: string } }
    | undefined;
  return report?.header?.glibcVersionRuntime ? '-gnu' : '-musl';
}

export function getForegroundHelperPath() {
  const override = process.env[foregroundHelperEnvName];
  if (override && fs.existsSync(override)) return override;

  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    return;
  }
  if (process.arch !== 'x64' && process.arch !== 'arm64') {
    return;
  }

  const target = `${process.platform}-${process.arch}${linuxLibcSuffix()}`;
  const helperPath = path.join(packageRoot(), 'bin', target, 'foreground');
  return fs.existsSync(helperPath) ? helperPath : undefined;
}

export function runAfterCommand(command: string) {
  const helperPath = getForegroundHelperPath();
  if (helperPath) {
    execFileSync(helperPath!, ['sh', '-c', command], {
      stdio: 'inherit',
      encoding: 'utf8',
    });
    return;
  }

  execSync(command, { stdio: 'inherit', encoding: 'utf8' });
}
