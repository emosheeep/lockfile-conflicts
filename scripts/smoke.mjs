import { $, fs, path, tmpdir } from 'zx';

$.verbose = Boolean(process.env.DEBUG);

const root = process.cwd();
const cli = path.join(root, 'dist/index.js');
const runRoot = path.join(tmpdir(), `lockfile-conflicts-smoke-${process.pid}`);

function env(extra = {}) {
  return { ...process.env, ...extra };
}

async function run(name, fn) {
  process.stdout.write(`smoke ${name} ... `);
  await fn();
  console.log('ok');
}

async function initRepo(dir, globalConfig) {
  await fs.remove(dir);
  await fs.ensureDir(dir);
  await $({
    cwd: dir,
    env: env({ GIT_CONFIG_GLOBAL: globalConfig }),
  })`git init -q`;
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

await fs.remove(runRoot);
await fs.ensureDir(runRoot);

await run('global core.hooksPath safety', async () => {
  const repo = path.join(runRoot, 'global-safety');
  const globalHooks = path.join(runRoot, 'global-hooks');
  const globalConfig = path.join(runRoot, 'global.gitconfig');
  await fs.ensureDir(globalHooks);
  await fs.writeFile(globalConfig, `[core]\n\thooksPath = ${globalHooks}\n`);
  await initRepo(repo, globalConfig);

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
  await initRepo(repo, '/dev/null');
  await $({
    cwd: repo,
    env: env({ GIT_CONFIG_GLOBAL: '/dev/null' }),
  })`node ${cli} install`;
  await $({
    cwd: repo,
    env: { PATH: '/usr/bin:/bin', GIT_CONFIG_GLOBAL: '/dev/null' },
  })`bash .git/hooks/post-checkout`;
});

await run('missing config exits zero', async () => {
  const repo = path.join(runRoot, 'missing-config');
  await initRepo(repo, '/dev/null');
  await $({
    cwd: repo,
    env: env({ GIT_CONFIG_GLOBAL: '/dev/null' }),
  })`node ${cli} install`;
  await writeExecutable(
    path.join(repo, 'node_modules/.bin/lockfile'),
    `#!/usr/bin/env sh\nexec node ${cli} "$@"\n`,
  );
  await fs.remove(path.join(repo, '.lockfile'));
  await $({
    cwd: repo,
    env: env({ GIT_CONFIG_GLOBAL: '/dev/null' }),
  })`bash .git/hooks/post-checkout`;
});

await run('nested config resolves sibling node_modules bin', async () => {
  const repo = path.join(runRoot, 'nested-config');
  const result = path.join(runRoot, 'nested-config-result');
  await initRepo(repo, '/dev/null');
  await fs.ensureDir(path.join(repo, 'packages/app'));
  await fs.writeFile(path.join(repo, 'packages/app/package.json'), '{}');
  await $({
    cwd: repo,
    env: env({ GIT_CONFIG_GLOBAL: '/dev/null' }),
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
  await $({
    cwd: repo,
    env: env({ GIT_CONFIG_GLOBAL: '/dev/null' }),
  })`bash .git/hooks/post-checkout`;
  const output = await fs.readFile(result, 'utf8');
  if (!output.includes('nested-lockfile') || output.includes('root-lockfile')) {
    throw new Error(`unexpected nested config output: ${output}`);
  }
});

await run('failing runAfter exits zero', async () => {
  const repo = path.join(runRoot, 'runafter-fail');
  await initRepo(repo, '/dev/null');
  await fs.writeFile(path.join(repo, 'package.json'), '{}');
  await fs.writeFile(path.join(repo, 'pnpm-lock.yaml'), 'lock');
  await $({
    cwd: repo,
    env: env({ GIT_CONFIG_GLOBAL: '/dev/null' }),
  })`git add package.json pnpm-lock.yaml`;
  await $({
    cwd: repo,
    env: env({
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'a',
      GIT_AUTHOR_EMAIL: 'a@b.c',
      GIT_COMMITTER_NAME: 'a',
      GIT_COMMITTER_EMAIL: 'a@b.c',
    }),
  })`git commit -q -m init`;
  await $({
    cwd: repo,
    env: env({ GIT_CONFIG_GLOBAL: '/dev/null' }),
  })`node ${cli} install`;
  await fs.outputJson(path.join(repo, '.lockfile/config.json'), {
    lockfilePattern: 'pnpm-lock.yaml',
    runAfter: 'node -e "process.exit(1)"',
    commitMessage: 'chore: update lockfile',
  });
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
  await $({
    cwd: repo,
    env: env({ GIT_CONFIG_GLOBAL: '/dev/null' }),
  })`bash .git/hooks/post-commit`;
});

await run('Husky v9 shim target', async () => {
  const repo = path.join(runRoot, 'husky');
  await initRepo(repo, '/dev/null');
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
    env: env({ GIT_CONFIG_GLOBAL: '/dev/null' }),
  })`git config --local core.hooksPath .husky/_`;
  await $({
    cwd: repo,
    env: env({ GIT_CONFIG_GLOBAL: '/dev/null' }),
  })`node ${cli} install`;
  const parentHook = path.join(repo, '.husky/post-checkout');
  if (!(await fs.pathExists(parentHook)))
    throw new Error('expected parent Husky hook');
  const shim = await fs.readFile(
    path.join(repo, '.husky/_/post-checkout'),
    'utf8',
  );
  if (shim.includes('lockfile hook'))
    throw new Error('unexpected injection in Husky shim');
  await $({
    cwd: repo,
    env: { PATH: '/usr/bin:/bin', GIT_CONFIG_GLOBAL: '/dev/null' },
  })`sh .husky/_/post-checkout`;
});

await run('shared worktree hook resolves current worktree bin', async () => {
  const main = path.join(runRoot, 'worktree-main');
  const linked = path.join(runRoot, 'worktree-linked');
  await initRepo(main, '/dev/null');
  await fs.writeFile(path.join(main, 'a'), 'a');
  const gitEnv = env({
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'a',
    GIT_AUTHOR_EMAIL: 'a@b.c',
    GIT_COMMITTER_NAME: 'a',
    GIT_COMMITTER_EMAIL: 'a@b.c',
  });
  await $({ cwd: main, env: gitEnv })`git add a`;
  await $({ cwd: main, env: gitEnv })`git commit -q -m init`;
  await $({ cwd: main, env: gitEnv })`git worktree add -q ${linked}`;
  await $({ cwd: main, env: gitEnv })`node ${cli} install`;

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
  await $({
    cwd: linked,
    env: env({ GIT_CONFIG_GLOBAL: '/dev/null' }),
  })`bash ${path.join(main, '.git/hooks/post-checkout')}`;
  const output = await fs.readFile(result, 'utf8');
  if (!output.includes(`linked-lockfile ${linked}`)) {
    throw new Error(`unexpected worktree output: ${output}`);
  }
});

await fs.remove(runRoot);
