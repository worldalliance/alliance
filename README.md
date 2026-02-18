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

dev: `cd apps/frontend && yarn dev` (or `yarn frontend:dev` from root dir)

### admin

dev: `cd apps/admin && yarn dev` (or `yarn admin:dev` from root dir)

### server

Install bun 1.3.6 on your computer.

dev: `cd server && bun dev`

When open ing the app local ly for the first time, you can log in with the account specified by `ADMIN_USER` and `ADMIN_PASSWORD` in your .env file (this account will be automatically added to the db on startup :)

### mobile

dev: `cd apps/mobile && yarn start`

build: `yarn eas build --platform [ios|android]`

## Miscellaneous commands

### Openapi client gen:

`yarn gen-api` (in root dir, dev server must be running)

### Server migrations

generate migrations (in server/): `bun migration:generate -- migrations/[name of migration]`

run migrations `bun migration:run`
