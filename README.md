# Alliance

## Useful Commands

### Frontend

dev: `yarn workspace @alliance/frontend dev`

Storybook: `yarn storybook`

## Server

dev: `npm start:dev`

### Certbot

`sudo dnf install -y certbot python3-certbot-nginx`

`sudo certbot --nginx -d alliance-beta.xyz -d admin.alliance-beta.xyz`

### Openapi client gen:

`cd shared && yarn gen-api` (with dev server running)
