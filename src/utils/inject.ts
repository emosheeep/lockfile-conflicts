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

export function removeGitAttributes() {
  const filePath = getGirAttributes();
  if (!fs.existsSync(filePath)) return;
  const pair = `merge=${name}`;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let wasHit = false;
  for (let i = 0; i < lines.length; i++) {
    let item = lines[i];
    if (!item.includes(pair)) continue;
    item = item.replace(pair, '').trim();
    // remove line if no paris contains (check space)
    lines[i] = item.includes(' ') ? item : '';
    wasHit = true;
  }

  wasHit && fs.writeFile(filePath, lines.join('\n'));
}

export function injectGitAttributes() {
  const { lockfilePattern } = getConfigJson();
  const filePath = getGirAttributes();
  const pair = `merge=${name}`;
  const pattern = `${lockfilePattern} ${pair}`;

  if (!fs.existsSync(filePath)) {
    return fs.writeFileSync(filePath, pattern);
  }

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let wasHit = false;
  for (let i = 0; i < lines.length; i++) {
    const item = lines[i];
    if (!item.startsWith(lockfilePattern)) continue;
    wasHit = true;
    if (!item.includes(pair)) {
      lines[i] = item + ` ${pair}`; // append rule
    }
  }

  wasHit
    ? fs.writeFileSync(filePath, lines.join('\n'))
    : fs.appendFileSync(filePath, `\n${pattern}`);
}
