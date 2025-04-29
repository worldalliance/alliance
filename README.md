# Alliance

## UsefulCommands

## Frontend

Dev server: `npm run dev`

Storybook: `yarn storybook`

### Certbot

`sudo dnf install -y certbot python3-certbot-nginx`
`sudo certbot --nginx -d alliance-beta.xyz -d admin.alliance-beta.xyz`

### Openapi client gen:

`npx openapi-typescript http://localhost:3005/openapi.yaml -o frontend/src/lib/schema.d.ts`
