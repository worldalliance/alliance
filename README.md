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

### ssr server

dev: `yarn ssr:dev`

### server

dev: `cd server && npm run start:dev`

### mobile

dev: `cd apps/mobile && yarn start`

build: `yarn eas build --platform [ios|android]`

## Miscellaneous commands

### Certbot

`sudo dnf install -y certbot python3-certbot-nginx`

`sudo certbot --nginx -d alliance-beta.xyz -d admin.alliance-beta.xyz`

### Openapi client gen:

`yarn gen-api` (with dev server running)
