# Alliance

## Setup

**client/mobile:**

`yarn install`

**server:**

`cd server`

`npm install`

`cp .env.example .env` (and make any necessary edits)

Set up postgres database running locally with username/password/db name matching .env file

## Running Locally

### frontend

dev: `cd apps/frontend && yarn dev`

storybook: `yarn workspace @alliance/frontend storybook`

### server

dev: `cd server && npm run start:dev`

### mobile

dev: `cd apps/mobile && yarn start`

build: `yarn eas build --platform [ios|android]`

## Miscellaneous commands

### Openapi client gen:

`yarn gen-api` (in top level folder, dev server must be running)

### Server migrations

generate migrations: `npm run migration:generate -- migrations/[name of migration]`

run migrations `npm run migration:run`
