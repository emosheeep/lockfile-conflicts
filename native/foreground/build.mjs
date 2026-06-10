import { $, fs, path } from 'zx';

const root = process.cwd();

function readOption(name) {
  const prefix = `${name}=`;
  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];
  const item = process.argv.find((arg) => arg.startsWith(prefix));
  return item ? item.slice(prefix.length) : undefined;
}

function linuxLibcSuffix() {
  if (process.platform !== 'linux') return '';
  const report = process.report?.getReport?.();
  return report?.header?.glibcVersionRuntime ? '-gnu' : '-musl';
}

function defaultPackageTarget() {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    throw new Error(`unsupported platform: ${process.platform}`);
  }
  if (process.arch !== 'x64' && process.arch !== 'arm64') {
    throw new Error(`unsupported arch: ${process.arch}`);
  }
  return `${process.platform}-${process.arch}${linuxLibcSuffix()}`;
}

const packageTarget = readOption('--package-target') || defaultPackageTarget();
const cc = readOption('--cc') || process.env.CC || 'cc';
const extraCflags = (process.env.CFLAGS || '').split(/\s+/).filter(Boolean);
function defaultLdflags() {
  if (process.platform === 'darwin') return ['-Wl,-dead_strip'];
  if (process.platform === 'linux') return ['-Wl,--gc-sections'];
  return [];
}

const extraLdflags = (process.env.LDFLAGS || '').split(/\s+/).filter(Boolean);
const ldflags = extraLdflags.length ? extraLdflags : defaultLdflags();
const source = path.join(root, 'native/foreground/foreground.c');
const destination = path.join(root, 'bin', packageTarget, 'foreground');

await fs.ensureDir(path.dirname(destination));
await $`${cc} -Os -s -fdata-sections -ffunction-sections ${extraCflags} ${source} ${ldflags} -o ${destination}`;
await fs.chmod(destination, 0o755);
await $({ nothrow: true })`strip ${destination}`;
console.log(`built ${destination}`);
