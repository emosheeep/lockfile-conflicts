import { getConfigJson } from './config';
import { name, banner, hooks } from './constants';
import { getGirAttributes, getHooksPath } from './git';

export function forEachHooks(
  callback: (filename: string, scripts: string[]) => void,
) {
  const hookDir = getHooksPath();
  for (const [hookName, scripts] of Object.entries(hooks)) {
    callback(path.resolve(hookDir, hookName), scripts);
  }
}

export function replaceShellScript(filePath: string, content?: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const start = lines.findIndex((s) => s.startsWith(banner[0]));
  const end = lines.findLastIndex((s) => s.startsWith(banner[1]));
  if ([start, end].every((v) => v !== -1)) {
    lines.splice(start, end - start + 1, content!);
    fs.writeFileSync(filePath, lines.join('\n'));

    return true;
  }
}

export function injectShellScript(filePath: string, scripts: string[]) {
  const scriptContent = `${banner[0]}\n${scripts.join('\n')}\n${banner[1]}`;

  // create if doesn't exist
  if (!fs.existsSync(filePath)) {
    fs.ensureFileSync(filePath);
    return fs.writeFileSync(filePath, `#!/bin/bash\n\n${scriptContent}`);
  }

  // replace the old scripts with new scripts.
  replaceShellScript(filePath, scriptContent) ||
    // append scripts
    fs.appendFileSync(filePath, `\n${scriptContent}`);
}

export function replaceGitAttributes(pattern?: string) {
  const filePath = getGirAttributes();
  if (!fs.existsSync(filePath)) return;
  const { lockfilePattern } = getConfigJson();
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const start = lines.findIndex((s) => s.startsWith(lockfilePattern));
  if (start !== -1) {
    lines.splice(start, 1, pattern!);
    fs.writeFileSync(filePath, lines.join('\n'));
    return true;
  }
}

export function injectGitAttributes() {
  const { lockfilePattern } = getConfigJson();
  const filePath = getGirAttributes();
  const pattern = `${lockfilePattern} merge=${name}`;

  if (!fs.existsSync(filePath)) {
    return fs.writeFileSync(filePath, pattern);
  }

  replaceGitAttributes(pattern) || fs.appendFileSync(filePath, pattern);
}
