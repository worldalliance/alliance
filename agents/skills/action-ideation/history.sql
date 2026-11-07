BEGIN READ ONLY;
SELECT jsonb_build_object(
  'exported_at', CURRENT_TIMESTAMP,
  'records', COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'name', a.name,
    'short_description', a."shortDescription",
    'body', a.body,
    'task_form_id', a."taskFormId",
    'prerequisite_action_ids', a."prerequisiteActionIds",
    'optional', a.optional,
    'onboarding', a.onboarding,
    'archived', a.archived,
    'events', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'status', e."newStatus", 'date', e.date
    ) ORDER BY e.date, e.id), '[]'::jsonb)
      FROM action_event e WHERE e."actionId" = a.id AND e."deletedAt" IS NULL),
    'stats', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
      'completed', s."usersCompleted",
      'joined', s."usersJoined",
      'withdrawn', s."usersWithdrawn",
      'calculated_at', s."lastCalculatedAt",
      'member_action_start', s."memberActionStartDate",
      'member_action_end', s."memberActionEndDate"
    ) END
  ) ORDER BY a.id), '[]'::jsonb)
)
FROM action a
LEFT JOIN action_stats_record s ON s."actionId" = a.id AND s."deletedAt" IS NULL
WHERE a."deletedAt" IS NULL;
COMMIT;
