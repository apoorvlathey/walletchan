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

## Publishing or reviewing the extension for Firefox
The extension is automatically published to the Firefox Add-ons store when a new GitHub release is created.

Mozilla Addon Reviewers can review the extension by following the steps in [building-from-source](#building-from-source).