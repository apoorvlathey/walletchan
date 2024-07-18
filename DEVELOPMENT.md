# Development

## Pre-requisites
- Node.js (see .nvmrc for the version)
- Yarn

## Building from source
1. Install dependencies using yarn `yarn install`
2. Build the extension using `yarn build`
3. The built extension will be available in the `build` directory

## Running the extension in development mode
The extension can be run in development mode on Chrome or Firefox.
1. Install the dependencies using yarn `yarn install`
2. Build the extension using `yarn build`
3. Use the appropriate script to load the extension in development mode:
   - Chrome: `yarn chrome:start`
   - Firefox: `yarn firefox:start`
4. This will start a new brower instance with the extension loaded. You can now test the extension by visiting any dapp and connecting the wallet.
