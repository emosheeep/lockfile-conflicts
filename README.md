# Lockfile Conflicts Merging Driver

[![npm version](https://img.shields.io/npm/v/lockfile-conflicts)](https://npmjs.com/package/lockfile-conflicts)
![weekly downloads](https://img.shields.io/npm/dw/lockfile-conflicts)
![license](https://img.shields.io/npm/l/lockfile-conflicts)
![stars](https://img.shields.io/github/stars/emosheeep/lockfile-conflicts)

Helps to merge lockfile conflicts and update automatically after merge/rebase.

![example](https://raw.githubusercontent.com/emosheeep/lockfile-conflicts/HEAD/assets/lockfile-conflicts.gif)

## Quick start

First of all, install the dependencies in your project.

```shell
pnpm install lockfile-conflicts -D
```

Edit `package.json` > prepare script and run it once:

```shell
npm pkg set scripts.prepare="lockfile install"
npm run prepare
```

And then commit the changes made by the command. After installed, a custom merge driver will be defined and applied to merge certain files.

## Use with git hook

In order to execute custom scripts automatically at proper time, we need to inject some shell script to git hooks, **which may cause conflicts with other git hook tools**, e.g. _husky, simple-git-hooks_ and so on.

In this case, you can place install script right after theirs. For an example:

```json
{
  "scripts": {
    "prepare": "husky install && lockfile install",
    "prepare": "simple-git-hooks && lockfile install",
    "prepare": "<other git hooks tool> && lockfile install"
  }
}
```

## What does it do

When it was installed. it has done these things:

1. Initialize config directory (default is .lockfile), see [Introduction](./config/README.md).
2. Add git config to local repository, you can view them through `git config -l --local`.
3. Inject shell scripts to some git hooks, which helps to execute custom script at proper time.

Don't worry, all of these can be removed easily by execute `npx lockfile uninstall [--force]`, they can hardly make pollution.

# About merge driver

> This section is revised from [Example of how to configure a custom git merge driver](https://github.com/Praqma/git-merge-driver)

A merge driver defines how git merge a certain file, it usually uses with `.gitattributes`. For more, visit [Docs - Git Attributes](https://git-scm.com/docs/gitattributes).

## Define the driver

This is done in the `.git/config` file using `git config` command:
```shell
git config merge.[driver-name].name xxx
git config merge.[driver-name].driver xxx
```

```properties
[merge "lockfile-conflicts"]
  name = A custom merge driver used to resolve conflicts in certain files
  driver = lockfile merge %O %A %B %P
```

The `merge` block contains the merge driver's **identifier**, it
's `lockfile-conflicts` here, used to reference the merge driver later.

The `name` property contains a description of the merge driver, this project doesn't use this property because it's not necessary.

The `driver` property contains the command that will be called when a conflict occurs. There's a handful of predefined parameters, most notably:

- `%O`: ancestor’s version of the conflicting file
- `%A`: ours version of the conflicting file
- `%B`: theirs branch's version of the conflicting file
- `%P`: the conflicting file relative path

_Note: Any tools or scripts called by the merge driver must be available on `$PATH`_.

## Use driver to merge file

Add patterns you want the merge driver to be used for in the `.gitattributes` file:

```properties
# .gitattributes
*pnpm-lock.yaml merge=my-custom-driver
```

## Distribution

Note that, much like git hooks, the `.git/config` file can't be checked in/shared through the repository.

A common way of distributing merge drivers is to check the configuration file in elsewhere and provide a script to copy it to `.git/config`.

In this project, the step above is included by `lockfile install` command.

# Questions

## Why does `runAfter` to be triggered weirdly?

We execute `runAfter` by checking if there's a **conflicts information file** exist. 

The file will be recorded in a temp location under the config directory when it happened, and will be removed when you successfully rebase or merge. All of these steps depend on specified git hooks and also will be triggered by them.

But unfortunately, the lifecycle hooks that git provides are incomplete, which means we'll lose context and causes temp file remains if you abort a rebase or merge process.

Next time you succeed to make a commit action, the `post-commit` hook triggers as usual but it will execute `runAfter` because the temp file exist. This is why the case happens.

Don't worry about this, because **we'll delete temp file first to avoid mis-executing and these hook won't affect your commit result**. Just ignore it and then everything will be okay in next execution.

# Contribution

Please read the documentations of these useful tools before developing:

- [zx](https://github.com/google/zx) - Execute shell command conveniently in Node.js workflow.
- [commander](https://github.com/tj/commander.js) - Node.js command-line interfaces.
- [tsup](https://github.com/egoist/tsup) - A simple and fast builder based on esbuild.
- [changesets](https://github.com/changesets/changesets) - A way to manage your versioning and changelogs.
- and so do the other tools you'll develop with, please read the docs by yourself.

PR welcome if you have any constructive suggestions.
PR welcome if you have any constructive suggestions.