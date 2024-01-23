import { getConfigJson } from './config';
import { name, banner, hooks, shellBaseDir } from './constants';
import { getGirAttributes, getHooksPath } from './git';
import { joinNestedArray, splitFile } from './helper';

export function installHooks() {
  uninstallHooks();
  const hookDir = getHooksPath();
  for (const [hookName, scripts] of Object.entries(hooks)) {
    const hookPath = path.resolve(hookDir, hookName);
    injectShellScript(hookPath, scripts); // Add shell script into git hook
    fs.chmodSync(hookPath, '755'); // make file executable.
  }
}

export function uninstallHooks() {
  const hookDir = getHooksPath();
  // Remove possible script from the other hooks that are not configured.
  for (const hookName of fs.readdirSync(hookDir)) {
    const hookPath = path.resolve(hookDir, hookName);
    if (fs.statSync(hookPath).isDirectory()) continue;
    replaceShellScript(hookPath, '');
  }
}

export function replaceShellScript(filePath: string, content?: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = splitFile(filePath);
  const start = lines.findIndex((s) => s.startsWith(banner[0]));
  const end = lines.findLastIndex((s) => s.startsWith(banner[1]));
  if ([start, end].every((v) => v !== -1)) {
    lines.splice(start, end - start + 1, content!);
    fs.writeFileSync(filePath, lines.join('\n'));
    return true;
  }
}

export function injectShellScript(filePath: string, scripts: string[]) {
  const scriptContent = joinNestedArray([
    banner[0],
    "# Don't modify these lines and keep them at the bottom of the file.",
    '# Because every installation will try to remove and re-add them.',
    '(',
    [
      '# Open a sub-shell to avoid side effects on $PWD',
      `# This helps npx find executable bin file - node_modules/.bin/lockfile.`,
      `${shellBaseDir}`,
      ...scripts,
    ],
    ')',
    banner[1],
  ]);

  // create if doesn't exist
  if (!fs.existsSync(filePath)) {
    fs.ensureFileSync(filePath);
    return fs.writeFileSync(filePath, `#!/bin/bash\n\n${scriptContent}`);
  }

  // replace the old scripts with new scripts.
  replaceShellScript(filePath, scriptContent) ||
    // append scripts
    appendFile(filePath, scriptContent);
}

export function removeGitAttributes() {
  const filePath = getGirAttributes();
  if (!fs.existsSync(filePath)) return;
  const pair = `merge=${name}`;

  const lines = splitFile(filePath);
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

  const lines = splitFile(filePath);
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
    : appendFile(filePath, pattern);
}

/** Append content to the end of file and add a newline if needed */
function appendFile(filePath: string, content: string) {
  fs.ensureFileSync(filePath);
  const fileContent = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(
    filePath,
    fileContent +
      (!fileContent.length || fileContent.endsWith('\n')
        ? content
        : `\n${content}`),
  );
}
