# Alliance

## Setup

The repo root is a **Bun** workspace (hoisted `node_modules`, see `bunfig.toml`); `server/` is a separate Bun package with its own `bun.lock`.

**to install frontend deps**

In root dir: `bun install` (install [Bun](https://bun.sh) 1.3.x+ if missing; `packageManager` in root `package.json` pins `bun@1.3.6`)

**server install:**

`cd server`

`bun install`

`cp .env.example .env` (and make necessary edits)

Install PostgreSQL 17:

- **macOS (Homebrew):** `brew install postgresql@17 && brew services start postgresql@17`
- **Ubuntu/Debian:** Add the [PGDG apt repository](https://www.postgresql.org/download/linux/debian/), then install:
  ```bash
  sudo apt install -y postgresql-common
  sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
  sudo apt install -y postgresql-17
  ```
- **Windows:** Download the installer from https://www.postgresql.org/download/windows/

Set up a local database with username/password/db name matching .env file

## Running Locally

### frontend

Start the frontend: `cd apps/frontend && bun dev` (or `bun run frontend:dev` from root)

### admin

Start the admin panel: `cd apps/admin && bun dev` (or `bun run admin:dev` from root)

### server

#### First time only:

Install bun 1.3.6: `curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.6"` (If
you have done [Setup - to install frontend deps](#setup) then `bun` will have already been installed.)

Run the migrations: `(cd server && bun migration:run)`

_Note_ if you get an error `role "postgres" does not exist`, first run `createuser -s postgres`.
And if you get an error `database "alliance" does not exist`, first run `createdb alliance`.

Start the server: `cd server && bun dev` (or `bun server:dev` from root dir)

When opening the app locally for the first time, you can log in with the account specified by `ADMIN_USER` and `ADMIN_PASSWORD` in your .env file (this account will be automatically added to the db on startup)

### Loading data

Developers often want to test local code with a cleaned version of the production database. To allow for this, we have a script, `./misc/load_staging_data.sh` that will copy the data from the staging server into the local postgres. For this to work, you first need to set up your `.ssh/config` with a `staging` destination with the appropriate ssh key (ask an existing developer for the keys / ip)

### Viewing the database

`psql alliance -U postgres`

### Mobile

#### iOS

##### One time only:

1. Download [Xcode](https://apps.apple.com/us/app/xcode/id497799835) (for iOS)

2. If running on a physical device, enable Developer Mode: go to **Settings > Privacy & Security > Developer Mode** and toggle it on. (This option only appears after connecting your device to Xcode once.)

3. Set up the environment file (one time only):

From the root level:

```bash
([ ! -f apps/mobile/.env ] && cp apps/mobile/.env.example apps/mobile/.env || echo ".env already exists, skipping copy")
```

##### Build

1. Run on your iOS device (prebuild runs automatically):

```bash
(cd apps/mobile && bun run ios --device)
```

##### Other build scripts

- Build and run on a local simulator: `bun run --cwd apps/mobile build:simulator`
- Build into Xcode for App Store upload: use the `build:ios` / EAS scripts in `apps/mobile` (see `apps/mobile/package.json`)

(you can find your device id via `xcrun xctrace list devices`)

#### Android

Enable Developer Options on your device: go to **Settings > About phone** and tap **Build number** 7 times. Then go to **Settings > Developer options** and enable **USB debugging**.

Add the expo build onto your device:

```bash
(cd apps/mobile && bun run android)
```

#### Start the expo server

(For both Android and iOS)

```bash
(cd apps/mobile && bun run start)
```

## Miscellaneous commands

### Openapi client gen:

`bun run gen-api` (in root dir, dev server must be running)

### Server migrations

generate migrations (in server/): `bun migration:generate -- migrations/[name of migration]`

run migrations `bun migration:run`
