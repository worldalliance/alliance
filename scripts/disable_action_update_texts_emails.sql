-- Needs -v apply=true|false. Rows go in as 'migrated' so this runs before the new_account source deploys.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE before ON COMMIT DROP AS
SELECT u.id,
  coalesce(t.enabled, u."textByDefault") AS text_on,
  coalesce(e.enabled, u."emailByDefault") AS email_on
FROM "user" u
LEFT JOIN notification_preference t
  ON t."userId" = u.id AND t.kind = 'action_updates' AND t.channel = 'text'
LEFT JOIN notification_preference e
  ON e."userId" = u.id AND e.kind = 'action_updates' AND e.channel = 'email'
WHERE u."deletedAt" IS NULL;

SELECT
  count(*) FILTER (WHERE p.channel = 'text') AS members_opted_out_of_texts,
  count(*) FILTER (WHERE p.channel = 'email') AS members_opted_out_of_emails
FROM notification_preference p
JOIN "user" u ON u.id = p."userId" AND u."deletedAt" IS NULL
WHERE p.kind = 'action_updates' AND p.source = 'member' AND NOT p.enabled;

INSERT INTO notification_preference ("userId", kind, channel, enabled, source)
SELECT u.id, 'action_updates', c.channel::notification_preference_channel_enum, false, 'migrated'
FROM "user" u CROSS JOIN (VALUES ('text'), ('email')) AS c(channel)
ON CONFLICT ("userId", kind, channel) DO UPDATE SET enabled = false, source = 'migrated'
WHERE notification_preference.source <> 'member';

SELECT
  count(*) AS live_users,
  count(*) FILTER (WHERE b.text_on) AS text_on_before,
  count(*) FILTER (WHERE coalesce(t.enabled, u."textByDefault")) AS text_on_after,
  count(*) FILTER (WHERE b.email_on) AS email_on_before,
  count(*) FILTER (WHERE coalesce(e.enabled, u."emailByDefault")) AS email_on_after
FROM before b
JOIN "user" u ON u.id = b.id
LEFT JOIN notification_preference t
  ON t."userId" = u.id AND t.kind = 'action_updates' AND t.channel = 'text'
LEFT JOIN notification_preference e
  ON e."userId" = u.id AND e.kind = 'action_updates' AND e.channel = 'email';

\if :apply
  COMMIT;
  \echo 'Committed.'
\else
  ROLLBACK;
  \echo 'Dry run, rolled back.'
\endif
