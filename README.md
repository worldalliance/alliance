# Alliance

## Setup

Currently, frontend/, admin/, and shared/, are part of a yarn monorepo, while server/ is a separate npm-managed project.

**to install frontend deps**

In root dir: `yarn install` (install yarn version `4.9.1` via corepack if missing)

**server install:**

`cd server`

`npm install`

`cp .env.example .env` (and make necessary edits)

Set up postgres database running locally with username/password/db name matching .env file

## Running Locally

### frontend

dev: `cd apps/frontend && yarn dev` (or `yarn frontend:dev` from root dir)

### admin

dev: `cd apps/admin && yarn dev` (or `yarn admin:dev` from root dir)

### server

dev: `cd server && npm run start:dev` (or `yarn server:dev` from root dir)

When opening the app locally for the first time, you can log in with the account specified by `ADMIN_USER` and `ADMIN_PASSWORD` in your .env file (this account will be automatically added to the db on startup)

### mobile

dev: `cd apps/mobile && yarn start`

build: `yarn eas build --platform [ios|android]`

## Miscellaneous commands

### Openapi client gen:

`yarn gen-api` (in root dir, dev server must be running)

### Server migrations

generate migrations (in server/): `npm run migration:generate -- migrations/[name of migration]`

run migrations `npm run migration:run`
