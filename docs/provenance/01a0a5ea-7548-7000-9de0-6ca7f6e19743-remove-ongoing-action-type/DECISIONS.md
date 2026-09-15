# Decisions

- The migration checks for `Ongoing` actions itself and throws with their ids,
  before any other statement. The generated `USING "type"::text::action_type_enum`
  cast would already fail on such a row, but with a Postgres enum error that
  doesn't say what to do. Migrations run in one transaction, so the throw leaves
  `taskContents` in place. Verified locally by marking one action `Ongoing`,
  running the migration, and checking that the column and value survived.
- The `down` migration is the generated one. It restores the enum value and an
  empty `taskContents` column. The column's data is gone.
- `ActionTaskPanelActivity` rendered only for `Ongoing` actions and was the only
  reader of `taskContents`, so it's deleted. Its `createAccountHref` prop on
  `ActionTaskPanel`, and the value `ActionPageTaskPanel` passed into it, went
  with it.
- The admin `testActions` fixture loses its whole `Ongoing` entry ("Use public
  transportation instead of driving"). The frontend `testTodoActions` fixture
  loses its `Ongoing` item ("Stop buying from Coca-Cola"). Neither array has any
  importer. They were already dead before this change and stay in place.
- e2e tests stop setting `taskContents` on the actions they create. None of them
  asserted on it.
- `citesting/fixtures/seed_dataonly.sql` was regenerated with
  `citesting/scripts/reseed.sh`, because its `COPY public.action` lists
  `taskContents` and would fail to load. The seed was nine migrations behind, so
  the diff also carries those migrations' changes (new empty tables,
  `comment."tagId"`, `user` columns) and a different action row order.
- Old action export JSON can still carry `taskContents`. `importAction` spreads it
  into `actionRepo.insert`, which only writes known columns, so the key is
  ignored. An export with `type: "Ongoing"` fails at the enum on insert.
