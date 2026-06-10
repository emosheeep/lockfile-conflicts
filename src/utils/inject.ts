import { getConfigJson, getRelBinDir } from './config';
import { name, banner, hooks } from './constants';
import { getGirAttributes, resolveHookTarget } from './git';
import { joinNestedArray, splitFile } from './helper';

export async function installHooks() {
  await uninstallHooks();
  for (const [hookName, scripts] of Object.entries(hooks)) {
    const { hookPath } = await resolveHookTarget(hookName);
    await injectShellScript(hookPath, scripts); // Add shell script into git hook
    fs.chmodSync(hookPath, '755'); // make file executable.
  }
}

export async function uninstallHooks() {
  // Remove possible stale injected blocks from both the raw Git-executed hook
  // and the resolved user hook. They can differ when a hook manager uses shim
  // scripts, for example Husky v9's `.husky/_/<hook>` launcher.
  for (const hookName of Object.keys(hooks)) {
    for (const hookPath of (await resolveHookTarget(hookName)).cleanupPaths) {
      replaceShellScript(hookPath, '');
    }
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

export async function injectShellScript(filePath: string, scripts: string[]) {
  const binDir = await getRelBinDir();
  const scriptContent = joinNestedArray([
    banner[0],
    "# Don't modify these lines and keep them at the bottom of the file.",
    '# Because they will be removed and re-added every time in installation.',
    '(',
    // Keep environment changes inside this subshell and resolve the executable
    // from the current worktree at runtime.
    [
      `export PATH=${quoteShellPath(binDir)}:$PATH`,
      'command -v lockfile >/dev/null 2>&1 || exit 0',
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
  const wasReplaced = replaceShellScript(filePath, scriptContent);
  if (!wasReplaced) {
    // append scripts
    appendFile(filePath, scriptContent);
  }
}

export async function removeGitAttributes() {
  const filePath = await getGirAttributes();
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

  if (wasHit) {
    fs.writeFile(filePath, lines.join('\n'));
  }
}

export async function injectGitAttributes() {
  const { lockfilePattern } = await getConfigJson();
  const filePath = await getGirAttributes();
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

  if (wasHit) {
    fs.writeFileSync(filePath, lines.join('\n'));
  } else {
    appendFile(filePath, pattern);
  }
}

/** Quote a path so the injected hook remains valid for paths with spaces or quotes. */
function quoteShellPath(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
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
