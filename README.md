# Alliance

## Setup

Currently, frontend/, admin/, and shared/, are part of a yarn monorepo, while server/ is a separate npm-managed project.

**to install frontend deps**

In root dir: `yarn install` (install yarn version `4.9.1` via corepack if missing)

**server install:**

`cd server`

`bun install`

`cp .env.example .env` (and make necessary edits)

Set up postgres database running locally with username/password/db name matching .env file

## Running Locally

### frontend

Start the frontend: `cd apps/frontend && yarn dev` (or `yarn frontend:dev` from root dir)

### admin

Start the admin panel: `cd apps/admin && yarn dev` (or `yarn admin:dev` from root dir)

### server

(First time only) install bun 1.3.6: `curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.6"`

Run the migrations: `(cd server && bun migration:run)`

Start the server: `cd server && bun dev` (or `bun server:dev` from root dir)

When opening the app locally for the first time, you can log in with the account specified by `ADMIN_USER` and `ADMIN_PASSWORD` in your .env file (this account will be automatically added to the db on startup)

### mobile

Running the app with expo is a two step process:

- prebuilding / creating the development build (`npx expo prebuild`)
- running the expo dev server which the build connects to. (`npx expo start --dev-client`)

We have a few scripts that do both of these together, as well as installing needed pods deps:

- To build and run on a local simulator: `yarn build:simulator`
- To build into xcode for app store upload: `yarn buildprod`
- To build and run on a physical device: `npx expo prebuild && cd ios && pod install && cd .. && npx expo run:ios --device [your device id]`

(you can find your device id via `xcrun xctrace list devices`)

## Miscellaneous commands

### Openapi client gen:

`yarn gen-api` (in root dir, dev server must be running)

### Server migrations

generate migrations (in server/): `bun migration:generate -- migrations/[name of migration]`

run migrations `bun migration:run`
