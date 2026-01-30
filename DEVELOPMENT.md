# Development

## Pre-requisites

- Node.js (see .nvmrc for the version)
- pnpm

## Building from source

1. Install dependencies using pnpm `pnpm install`
2. Build the extension using `pnpm build`
3. The built extension will be available in the `build` directory

## Running the extension in development mode

The extension can be run in development mode on Chrome or Firefox.

1. Install the dependencies using pnpm `pnpm install`
2. Build the extension using `pnpm build`
3. Use the appropriate script to load the extension in development mode:
   - Chrome: `pnpm chrome:run`
   - Firefox: `pnpm firefox:run`
4. This will start a new brower instance with the extension loaded. You can now test the extension by visiting any dapp and connecting the wallet.

## Creating a Release

Releases are automated via GitHub Actions. When you push a version tag, the workflow will:

1. Build the extension
2. Create a zip file
3. Publish a GitHub release with the zip attached

### Steps to release a new version:

Simply run one of these commands based on the type of release:

```bash
pnpm release        # Tag and release current version (no bump)
pnpm release:patch  # 0.1.0 → 0.1.1 (bug fixes)
pnpm release:minor  # 0.1.0 → 0.2.0 (new features)
pnpm release:major  # 0.1.0 → 1.0.0 (breaking changes)
```

This automatically:

1. Bumps the version in `package.json`
2. Syncs the version to `public/manifest.json`
3. Creates a commit and git tag
4. Pushes to origin with tags
5. GitHub Actions creates the release at [Releases](https://github.com/apoorvlathey/bankr-wallet/releases)

### Manual release (optional)

If you need to create a release manually:

```bash
pnpm build
pnpm zip
```

Then upload `bankr-wallet.zip` to a new GitHub release.
