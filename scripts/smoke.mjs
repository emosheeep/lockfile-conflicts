import { $, fs, path, tmpdir } from 'zx';
import { spawn } from 'node:child_process';

$.verbose = Boolean(process.env.DEBUG);

const root = process.cwd();
const cli = path.join(root, 'dist/index.js');
const runRoot = path.join(tmpdir(), `lockfile-conflicts-smoke-${process.pid}`);
const managers = ['husky', 'simple-git-hooks'];

function env(extra = {}) {
  return { ...process.env, ...extra };
}

function gitEnv(extra = {}) {
  return env({
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'a',
    GIT_AUTHOR_EMAIL: 'a@b.c',
    GIT_COMMITTER_NAME: 'a',
    GIT_COMMITTER_EMAIL: 'a@b.c',
    ...extra,
  });
}

async function run(name, fn) {
  process.stdout.write(`smoke ${name} ... `);
  await fn();
  console.log('ok');
}

async function initRepo(dir) {
  await fs.remove(dir);
  await fs.ensureDir(dir);
  await $({ cwd: dir, env: gitEnv() })`git init -q`;
}

async function writeExecutable(file, content) {
  await fs.ensureDir(path.dirname(file));
  await fs.writeFile(file, content);
  await fs.chmod(file, 0o755);
}

async function assertNoLockfileBlock(dir) {
  if (!(await fs.pathExists(dir))) return;
  const grep = await $({
    nothrow: true,
  })`grep -R "lockfile hook\|lockfile-conflicts start" ${dir}`;
  if (grep.exitCode === 0) {
    throw new Error(`unexpected lockfile-conflicts block in ${dir}`);
  }
}

function prepareScript(manager) {
  if (manager === 'husky') return 'husky .husky && lockfile install';
  return 'simple-git-hooks && lockfile install';
}

function hookManagerPackage(manager) {
  if (manager === 'husky') return { husky: '^9.1.7' };
  return { 'simple-git-hooks': '^2.13.1' };
}

async function writeConsumerPackage(repo, manager) {
  const packageJsonPath = path.join(repo, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  packageJson.scripts = { prepare: prepareScript(manager) };
  packageJson.devDependencies = hookManagerPackage(manager);
  if (manager === 'simple-git-hooks') {
    packageJson['simple-git-hooks'] = {
      'post-checkout': 'echo simple-post-checkout >> .git/manager-hook.log',
    };
  }
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

async function createLinkedConsumer(name, manager) {
  const repo = path.join(runRoot, name);
  await initRepo(repo);
  await fs.writeFile(
    path.join(repo, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', private: true }, null, 2),
  );

  // Link first, then run pnpm install with the real consumer prepare script.
  await $({ cwd: repo, env: gitEnv() })`pnpm link ${root}`;
  await writeConsumerPackage(repo, manager);

  if (manager === 'husky') {
    await fs.ensureDir(path.join(repo, '.husky'));
    await fs.writeFile(
      path.join(repo, '.husky/post-checkout'),
      'echo husky-post-checkout >> .git/manager-hook.log\n',
    );
  }

  const install = await $({
    cwd: repo,
    env: gitEnv(),
    nothrow: true,
  })`pnpm i --config.dangerouslyAllowAllBuilds=true`;
  if (install.exitCode !== 0) {
    throw new Error(
      `pnpm install failed for ${manager}:\n${install.stdout}\n${install.stderr}`,
    );
  }

  const hookLog = path.join(repo, '.git/lockfile-wrapper.log');
  await writeExecutable(
    path.join(repo, 'node_modules/.bin/lockfile'),
    `#!/usr/bin/env sh\necho lockfile "$@" >> ${hookLog}\nexec node ${cli} "$@"\n`,
  );
  await fs.remove(hookLog);

  return { repo, hookLog };
}

async function commitAll(repo, message) {
  await $({ cwd: repo, env: gitEnv() })`git add .`;
  await $({ cwd: repo, env: gitEnv() })`git commit -q -m ${message}`;
}

async function assertManagerHookInitializedAndExecutes(manager) {
  const { repo, hookLog } = await createLinkedConsumer(
    `${manager}-initializes-hooks`,
    manager,
  );
  await commitAll(repo, 'init');

  const gitHooksPath = (
    await $({
      cwd: repo,
      env: gitEnv(),
    })`git rev-parse --path-format=absolute --git-path hooks/post-checkout`
  )
    .valueOf()
    .trim();
  if (!(await fs.pathExists(gitHooksPath))) {
    throw new Error(
      `expected Git-executed post-checkout hook at ${gitHooksPath}`,
    );
  }

  if (manager === 'husky') {
    const userHook = await fs.readFile(
      path.join(repo, '.husky/post-checkout'),
      'utf8',
    );
    if (!userHook.includes('lockfile hook post-checkout')) {
      throw new Error(
        `expected lockfile block in Husky user hook: ${userHook}`,
      );
    }
    if (userHook.includes('git rev-parse --show-toplevel')) {
      throw new Error(`expected simplified Husky hook block: ${userHook}`);
    }
  } else {
    const hook = await fs.readFile(gitHooksPath, 'utf8');
    if (
      !hook.includes('simple-post-checkout') ||
      !hook.includes('lockfile hook post-checkout')
    ) {
      throw new Error(
        `expected simple-git-hooks and lockfile in hook: ${hook}`,
      );
    }
    if (hook.includes('git rev-parse --show-toplevel')) {
      throw new Error(`expected simplified simple-git-hooks block: ${hook}`);
    }
  }

  await fs.remove(path.join(repo, '.git/manager-hook.log'));
  await fs.remove(hookLog);
  await $({
    cwd: repo,
    env: gitEnv(),
  })`git checkout -q -b verify-post-checkout`;

  const managerLog = await fs.readFile(
    path.join(repo, '.git/manager-hook.log'),
    'utf8',
  );
  if (
    !managerLog.includes(
      `${manager === 'husky' ? 'husky' : 'simple'}-post-checkout`,
    )
  ) {
    throw new Error(`expected ${manager} post-checkout marker: ${managerLog}`);
  }
  const lockfileLog = await fs.readFile(hookLog, 'utf8');
  if (!lockfileLog.includes('lockfile hook post-checkout')) {
    throw new Error(
      `expected lockfile post-checkout execution: ${lockfileLog}`,
    );
  }
}

async function configureRunAfter(repo, runAfter) {
  await fs.outputJson(path.join(repo, '.lockfile/config.json'), {
    lockfilePattern: 'pnpm-lock.yaml',
    runAfter,
    commitMessage: 'chore: update lockfile',
  });
}

async function createRealLockfileConflictRepo(manager, name, runAfter) {
  const { repo, hookLog } = await createLinkedConsumer(name, manager);
  await configureRunAfter(repo, runAfter);
  await fs.writeFile(path.join(repo, 'pnpm-lock.yaml'), 'base\n');
  await commitAll(repo, 'init');
  await $({ cwd: repo, env: gitEnv() })`git branch -M main`;

  await $({ cwd: repo, env: gitEnv() })`git checkout -q -b feature`;
  await fs.writeFile(path.join(repo, 'pnpm-lock.yaml'), 'feature\n');
  await commitAll(repo, 'feature lockfile');

  await $({ cwd: repo, env: gitEnv() })`git checkout -q main`;
  await fs.writeFile(path.join(repo, 'pnpm-lock.yaml'), 'main\n');
  await commitAll(repo, 'main lockfile');

  await $({ cwd: repo, env: gitEnv() })`git checkout -q feature`;
  await fs.remove(hookLog);

  return { repo, hookLog };
}

async function assertNoRebaseState(repo, label) {
  if (await fs.pathExists(path.join(repo, '.git/rebase-merge'))) {
    throw new Error(`expected ${label} to leave no .git/rebase-merge`);
  }
  if (await fs.pathExists(path.join(repo, '.git/rebase-apply'))) {
    throw new Error(`expected ${label} to leave no .git/rebase-apply`);
  }
}

async function runRebaseInPtyAndInterrupt(repo, extraEnv = {}) {
  const python = await $({ nothrow: true })`command -v python3`;
  if (python.exitCode !== 0) {
    throw new Error('python3 is required for Ctrl+C smoke test');
  }

  const driver = String.raw`
import os, pty, select, sys, time
repo = sys.argv[1]
pid, fd = pty.fork()
if pid == 0:
    os.chdir(repo)
    os.execvp('git', ['git', 'rebase', 'main'])
output = b''
interrupt_at = None
exit_code = 1
while True:
    ready, _, _ = select.select([fd], [], [], 0.1)
    if ready:
        try:
            chunk = os.read(fd, 4096)
        except OSError:
            chunk = b''
        if chunk:
            output += chunk
            os.write(1, chunk)
            if interrupt_at is None and b'setTimeout' in output:
                interrupt_at = time.monotonic() + 0.5
        else:
            done, status = os.waitpid(pid, 0)
            if os.WIFEXITED(status):
                exit_code = os.WEXITSTATUS(status)
            elif os.WIFSIGNALED(status):
                exit_code = 128 + os.WTERMSIG(status)
            break
    if interrupt_at is not None and time.monotonic() >= interrupt_at:
        os.write(fd, b'\x03')
        interrupt_at = None
    try:
        done, status = os.waitpid(pid, os.WNOHANG)
    except ChildProcessError:
        break
    if done == pid:
        if os.WIFEXITED(status):
            exit_code = os.WEXITSTATUS(status)
        elif os.WIFSIGNALED(status):
            exit_code = 128 + os.WTERMSIG(status)
        break
    if len(output) > 100000:
        os.kill(pid, 15)
        raise RuntimeError('pty output overflow')
sys.exit(exit_code)
`;

  return new Promise((resolve, reject) => {
    const child = spawn(python.stdout.trim(), ['-c', driver, repo], {
      cwd: repo,
      env: gitEnv(extraEnv),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ exitCode, output }));
  });
}

let wasForegroundHelperBuilt = false;
async function ensureTestForegroundHelper() {
  if (
    wasForegroundHelperBuilt &&
    (await fs.pathExists(path.join(root, 'bin')))
  ) {
    return;
  }
  const compiler = await $({ nothrow: true })`command -v cc`;
  if (compiler.exitCode !== 0) {
    throw new Error('cc is required to build foreground helper for smoke test');
  }
  await $({ cwd: root })`pnpm run build:foreground`;
  wasForegroundHelperBuilt = true;
}

async function runRealRebaseWithRunAfter(manager, name, runAfter) {
  const { repo, hookLog } = await createRealLockfileConflictRepo(
    manager,
    name,
    runAfter,
  );
  await assertNoRebaseState(repo, 'test setup');

  const rebase = await $({
    cwd: repo,
    env: gitEnv(),
    nothrow: true,
  })`git rebase main`;
  if (rebase.exitCode !== 0) {
    throw new Error(
      `expected ${manager} real git rebase to continue, got ${rebase.exitCode}:\n${rebase.stdout}\n${rebase.stderr}`,
    );
  }

  const log = await fs.readFile(hookLog, 'utf8');
  if (!log.includes('lockfile hook post-rewrite')) {
    throw new Error(`expected real rebase to run post-rewrite hook: ${log}`);
  }
  await assertNoRebaseState(repo, `${manager} real rebase`);
  if (await fs.pathExists(path.join(repo, '.lockfile/temp'))) {
    throw new Error(
      `expected ${manager} real rebase hook to clean .lockfile/temp`,
    );
  }
  return { repo, hookLog };
}

await fs.remove(runRoot);
await fs.ensureDir(runRoot);

await run('global core.hooksPath safety', async () => {
  const repo = path.join(runRoot, 'global-safety');
  const globalHooks = path.join(runRoot, 'global-hooks');
  const globalConfig = path.join(runRoot, 'global.gitconfig');
  await fs.ensureDir(globalHooks);
  await fs.writeFile(globalConfig, `[core]\n\thooksPath = ${globalHooks}\n`);
  await initRepo(repo);

  await $({
    cwd: repo,
    env: env({ GIT_CONFIG_GLOBAL: globalConfig }),
  })`node ${cli} install`;
  if (!(await fs.pathExists(path.join(repo, '.git/hooks/post-checkout')))) {
    throw new Error('expected repo .git/hooks/post-checkout to be installed');
  }
  await assertNoLockfileBlock(globalHooks);
});

await run('missing lockfile command exits zero', async () => {
  const repo = path.join(runRoot, 'missing-command');
  await initRepo(repo);
  await $({ cwd: repo, env: gitEnv() })`node ${cli} install`;
  await $({
    cwd: repo,
    env: { PATH: '/usr/bin:/bin', GIT_CONFIG_GLOBAL: '/dev/null' },
  })`bash .git/hooks/post-checkout`;
});

await run('missing config exits zero', async () => {
  const repo = path.join(runRoot, 'missing-config');
  await initRepo(repo);
  await $({ cwd: repo, env: gitEnv() })`node ${cli} install`;
  await writeExecutable(
    path.join(repo, 'node_modules/.bin/lockfile'),
    `#!/usr/bin/env sh\nexec node ${cli} "$@"\n`,
  );
  await fs.remove(path.join(repo, '.lockfile'));
  await $({ cwd: repo, env: gitEnv() })`bash .git/hooks/post-checkout`;
});

await run('nested config resolves sibling node_modules bin', async () => {
  const repo = path.join(runRoot, 'nested-config');
  const result = path.join(runRoot, 'nested-config-result');
  await initRepo(repo);
  await fs.ensureDir(path.join(repo, 'packages/app'));
  await fs.writeFile(path.join(repo, 'packages/app/package.json'), '{}');
  await $({
    cwd: repo,
    env: gitEnv(),
  })`node ${cli} install packages/app/.lockfile`;
  await writeExecutable(
    path.join(repo, 'node_modules/.bin/lockfile'),
    `#!/usr/bin/env sh\necho root-lockfile >> ${result}\nexit 0\n`,
  );
  await writeExecutable(
    path.join(repo, 'packages/app/node_modules/.bin/lockfile'),
    `#!/usr/bin/env sh\necho nested-lockfile >> ${result}\nexit 0\n`,
  );
  await fs.remove(result);
  await $({ cwd: repo, env: gitEnv() })`bash .git/hooks/post-checkout`;
  const output = await fs.readFile(result, 'utf8');
  if (!output.includes('nested-lockfile') || output.includes('root-lockfile')) {
    throw new Error(`unexpected nested config output: ${output}`);
  }
});

await run('legacy failing runAfter hook exits zero', async () => {
  const repo = path.join(runRoot, 'runafter-fail');
  await initRepo(repo);
  await fs.writeFile(path.join(repo, 'package.json'), '{}');
  await fs.writeFile(path.join(repo, 'pnpm-lock.yaml'), 'lock');
  await commitAll(repo, 'init');
  await $({ cwd: repo, env: gitEnv() })`node ${cli} install`;
  await configureRunAfter(repo, 'node -e "process.exit(1)"');
  await fs.outputFile(
    path.join(repo, '.lockfile/temp/conflicts'),
    'pnpm-lock.yaml',
  );
  await writeExecutable(
    path.join(repo, 'node_modules/.bin/lockfile'),
    `#!/usr/bin/env sh\nexec node ${cli} "$@"\n`,
  );
  await $({
    cwd: repo,
    env: env({
      PATH: `${repo}/node_modules/.bin:${process.env.PATH}`,
      GIT_CONFIG_GLOBAL: '/dev/null',
    }),
  })`lockfile hook post-commit`;
  await fs.outputFile(
    path.join(repo, '.lockfile/temp/conflicts'),
    'pnpm-lock.yaml',
  );
  await $({ cwd: repo, env: gitEnv() })`bash .git/hooks/post-commit`;
});

await run('Husky v9 shim target', async () => {
  const repo = path.join(runRoot, 'husky');
  await initRepo(repo);
  await fs.ensureDir(path.join(repo, '.husky/_'));
  await writeExecutable(
    path.join(repo, '.husky/_/h'),
    '#!/usr/bin/env sh\nn=$(basename "$0")\ns=$(dirname "$(dirname "$0")")/$n\n[ ! -f "$s" ] && exit 0\nsh -e "$s" "$@"\nexit $?\n',
  );
  await writeExecutable(
    path.join(repo, '.husky/_/post-checkout'),
    '#!/usr/bin/env sh\n. "$(dirname "$0")/h"\n',
  );
  await $({
    cwd: repo,
    env: gitEnv(),
  })`git config --local core.hooksPath .husky/_`;
  await $({ cwd: repo, env: gitEnv() })`node ${cli} install`;
  const parentHook = path.join(repo, '.husky/post-checkout');
  if (!(await fs.pathExists(parentHook))) {
    throw new Error('expected parent Husky hook');
  }
  const shim = await fs.readFile(
    path.join(repo, '.husky/_/post-checkout'),
    'utf8',
  );
  if (shim.includes('lockfile hook')) {
    throw new Error('unexpected injection in Husky shim');
  }
  await $({
    cwd: repo,
    env: { PATH: '/usr/bin:/bin', GIT_CONFIG_GLOBAL: '/dev/null' },
  })`sh .husky/_/post-checkout`;
});

await run('shared worktree hook resolves current worktree bin', async () => {
  const main = path.join(runRoot, 'worktree-main');
  const linked = path.join(runRoot, 'worktree-linked');
  await initRepo(main);
  await fs.writeFile(path.join(main, 'a'), 'a');
  const worktreeEnv = gitEnv();
  await $({ cwd: main, env: worktreeEnv })`git add a`;
  await $({ cwd: main, env: worktreeEnv })`git commit -q -m init`;
  await $({ cwd: main, env: worktreeEnv })`git worktree add -q ${linked}`;
  await $({ cwd: main, env: worktreeEnv })`node ${cli} install`;

  const result = path.join(runRoot, 'worktree-result');
  await writeExecutable(
    path.join(main, 'node_modules/.bin/lockfile'),
    `#!/usr/bin/env sh\necho main-lockfile "$PWD" >> ${result}\nexit 0\n`,
  );
  await fs.outputJson(path.join(linked, '.lockfile/config.json'), {
    lockfilePattern: 'pnpm-lock.yaml',
    runAfter: '',
    commitMessage: '',
  });
  await writeExecutable(
    path.join(linked, 'node_modules/.bin/lockfile'),
    `#!/usr/bin/env sh\necho linked-lockfile "$PWD" >> ${result}\nexit 0\n`,
  );
  await fs.remove(result);
  await $({ cwd: linked, env: gitEnv() })`bash ${path.join(
    main,
    '.git/hooks/post-checkout',
  )}`;
  const output = await fs.readFile(result, 'utf8');
  if (!output.includes(`linked-lockfile ${linked}`)) {
    throw new Error(`unexpected worktree output: ${output}`);
  }
});

for (const manager of managers) {
  await run(
    `${manager} pnpm-linked install initializes and executes hooks`,
    () => assertManagerHookInitializedAndExecutes(manager),
  );

  await run(`${manager} failed runAfter does not fail real rebase`, () =>
    runRealRebaseWithRunAfter(
      manager,
      `${manager}-runafter-fail-real-rebase`,
      'node -e "process.exit(1)"',
    ),
  );

  await run(
    `${manager} interrupted runAfter cleans temp and does not fail real rebase`,
    () =>
      runRealRebaseWithRunAfter(
        manager,
        `${manager}-runafter-interrupt-real-rebase`,
        'sh -c "kill -INT $PPID; exit 130"',
      ),
  );

  await run(
    `${manager} missing foreground helper falls back to direct runAfter`,
    async () => {
      await fs.remove(path.join(root, 'bin'));
      wasForegroundHelperBuilt = false;
      const { repo } = await runRealRebaseWithRunAfter(
        manager,
        `${manager}-missing-helper-fallback-real-rebase`,
        `node -e "require('fs').writeFileSync('.git/runafter-marker','ok')"`,
      );
      const marker = await fs.readFile(
        path.join(repo, '.git/runafter-marker'),
        'utf8',
      );
      if (marker !== 'ok') {
        throw new Error(`expected fallback runAfter marker, got ${marker}`);
      }
    },
  );

  await run(
    `${manager} Ctrl+C in real runAfter does not interrupt real rebase`,
    async () => {
      await ensureTestForegroundHelper();
      if (!(await fs.pathExists(path.join(root, 'bin')))) {
        throw new Error('expected packaged foreground helper to exist');
      }
      const { repo, hookLog } = await createRealLockfileConflictRepo(
        manager,
        `${manager}-runafter-ctrl-c-real-rebase`,
        'node -e "setTimeout(()=>{},30000)"',
      );
      const rebase = await runRebaseInPtyAndInterrupt(repo);
      if (rebase.exitCode !== 0) {
        throw new Error(
          `expected interrupted runAfter rebase to finish, got ${rebase.exitCode}:\n${rebase.output}`,
        );
      }
      await assertNoRebaseState(repo, `${manager} Ctrl+C real rebase`);
      if (await fs.pathExists(path.join(repo, '.lockfile/temp'))) {
        throw new Error(`expected ${manager} Ctrl+C rebase to clean temp`);
      }
      const log = await fs.readFile(hookLog, 'utf8');
      if (!log.includes('lockfile hook post-rewrite')) {
        throw new Error(
          `expected real rebase to run post-rewrite hook: ${log}`,
        );
      }
    },
  );
}

await fs.remove(runRoot);
