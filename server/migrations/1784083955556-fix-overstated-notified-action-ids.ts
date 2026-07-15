import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The reminder batch sent 2026-07-14 ~19:09–19:12 PT recorded
 * `notifiedActionIds = {140,141}` on all 172 of its action_event_notif rows,
 * but for most of them the message actually delivered (mail/mms/push body)
 * only named action 141. This corrects the rows to match what was sent:
 *
 *   - 143 rows whose text only mentioned action 141 → {141}
 *   - 2 rows (sent = false, no mail/mms/push ever created) → {}
 *   - the 27 rows whose text named both actions are left as {140,141}
 *
 * Ids were derived by matching each notif's mail.renderedHtml, mms.body, and
 * push.body against the names of actions 140 and 141.
 */
export class FixOverstatedNotifiedActionIds1784083955556
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE action_event_notif SET "notifiedActionIds" = '{141}' WHERE id = ANY($1)`,
      [ONLY_141_NOTIF_IDS],
    );
    await queryRunner.query(
      `UPDATE action_event_notif SET "notifiedActionIds" = '{}' WHERE id = ANY($1)`,
      [NOTHING_SENT_NOTIF_IDS],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE action_event_notif SET "notifiedActionIds" = '{140,141}' WHERE id = ANY($1)`,
      [[...ONLY_141_NOTIF_IDS, ...NOTHING_SENT_NOTIF_IDS]],
    );
  }
}

const ONLY_141_NOTIF_IDS = [
  22788, 22789, 22790, 22791, 22792, 22793, 22794, 22795, 22796, 22797, 22798,
  22799, 22800, 22802, 22803, 22804, 22805, 22806, 22807, 22808, 22809, 22810,
  22811, 22812, 22813, 22815, 22816, 22817, 22818, 22820, 22821, 22824, 22825,
  22826, 22827, 22828, 22829, 22830, 22831, 22832, 22833, 22834, 22835, 22836,
  22837, 22838, 22839, 22840, 22841, 22842, 22843, 22844, 22845, 22846, 22847,
  22848, 22849, 22850, 22851, 22852, 22854, 22855, 22856, 22857, 22858, 22860,
  22861, 22862, 22865, 22866, 22868, 22869, 22870, 22871, 22872, 22873, 22874,
  22875, 22876, 22877, 22878, 22879, 22882, 22884, 22886, 22887, 22888, 22889,
  22890, 22892, 22893, 22894, 22895, 22896, 22897, 22899, 22900, 22901, 22902,
  22904, 22905, 22906, 22907, 22908, 22910, 22912, 22913, 22914, 22915, 22917,
  22918, 22919, 22920, 22921, 22923, 22924, 22927, 22928, 22929, 22930, 22931,
  22932, 22933, 22934, 22936, 22937, 22938, 22939, 22941, 22942, 22943, 22944,
  22946, 22947, 22948, 22949, 22950, 22951, 22952, 22954, 22955, 22956, 22959,
];

const NOTHING_SENT_NOTIF_IDS = [22880, 22909];
