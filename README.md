# Alliance

## Useful Commands

### frontend

dev: `yarn frontend:dev`

Storybook: `yarn workspace @alliance/frontend storybook`

### server

dev: `npm start:dev`

### mobile

dev: `yarn start`

build: `yarn eas build --platform [ios|android]`

### Certbot

`sudo dnf install -y certbot python3-certbot-nginx`

`sudo certbot --nginx -d alliance-beta.xyz -d admin.alliance-beta.xyz`

### Openapi client gen:

`cd shared && yarn gen-api` (with dev server running)
