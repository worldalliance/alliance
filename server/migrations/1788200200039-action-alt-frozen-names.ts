import { MigrationInterface, QueryResult, QueryRunner } from "typeorm";

// Alt text a rename carried past equality with the name, so the match on the
// name below cannot reach it. Someone read the rows that match leaves and took
// the ones that read as an action name rather than a caption. The alt is
// matched alongside the id so a row edited since skips the update.
const FORMER_NAMES: [id: number, alt: string][] = [
  [10, "Make a reliability plan"],
  [
    122,
    "Commit to participate in the largest behavioral study on reduced animal product consumption",
  ],
  [123, "Recruit for our plant-based diet study"],
  [129, "For new members: introduce yourself to fellow Alliance members"],
  [131, "Send a letter of support to a nonprofit you support or benefit from"],
  [
    133,
    "Consider inviting people to the Alliance to support our next phase of growth",
  ],
  [134, "Download the Alliance mobile app"],
  [
    137,
    "Learn about battery supply chains and sign a letter to device manufacturers advocating for transparency",
  ],
  [143, "Donate or repair the clothing collected in last week’s action"],
  [146, "Ask questions to AI researchers at leading companies"],
  [
    152,
    "Submit a public comment to defend roadless areas in the United States",
  ],
];

export class ActionAltFrozenNames1788200200039 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const byName: QueryResult = await queryRunner.query(
      `UPDATE "action" SET "squareThumbnailImageAlt" = NULL
       WHERE "squareThumbnailImageAlt" = "name"`,
      undefined,
      true,
    );
    const byId: QueryResult = await queryRunner.query(
      `UPDATE "action" SET "squareThumbnailImageAlt" = NULL
       WHERE ("id", "squareThumbnailImageAlt")
         IN (SELECT * FROM unnest($1::int[], $2::text[]))`,
      [FORMER_NAMES.map(([id]) => id), FORMER_NAMES.map(([, alt]) => alt)],
      true,
    );
    console.log(
      `[action-alt-frozen-names] cleared ${byName.affected} names and ${byId.affected} former names`,
    );
  }

  // The cleared value was a copy of a name and nothing marks the rows it came
  // from, so there is nothing worth restoring.
  public async down(): Promise<void> {}
}
