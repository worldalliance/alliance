/**
 * Groups the action series that predate projects into projects. Action ids come
 * from prod/staging data, so this is a script rather than a migration.
 *
 * Reports what it would do and exits; pass --apply to write. Re-running is
 * safe: a project is found by name, and an action already in its project is
 * left alone. Any missing action id, or an action already in a different
 * project, aborts before anything is written.
 *
 *   (cd server && bun scripts/backfill-projects.ts)
 *   (cd server && bun scripts/backfill-projects.ts --apply)
 */
import { In } from "typeorm";
import { Action } from "../src/actions/entities/action.entity";
import { Project } from "../src/actions/entities/project.entity";
import dataSource from "../src/datasources/dataSource";

const PROJECTS: { name: string; actionIds: number[] }[] = [
  { name: "Opt-in utensils", actionIds: [80, 81] },
  { name: "Fast fashion", actionIds: [141, 142, 143] },
  { name: "Unclaimed property donation", actionIds: [70, 86] },
  { name: "Helen Keller International fundraiser", actionIds: [84, 87] },
  { name: "Local government public comment", actionIds: [53, 54] },
  { name: "E-waste", actionIds: [60, 64] },
  { name: "Plant-based diet study", actionIds: [122, 123] },
  { name: "California police AI records", actionIds: [91, 121, 135] },
  { name: "California June primary", actionIds: [124, 127] },
  { name: "$1,000 allocation", actionIds: [47, 49] },
  { name: "Potholes", actionIds: [48, 50] },
  { name: "Member introductions", actionIds: [126, 128, 129] },
  { name: "AI researcher AMA", actionIds: [146, 153] },
];

const apply = process.argv.includes("--apply");

async function main() {
  await dataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    const actionRepo = queryRunner.manager.getRepository(Action);
    const projectRepo = queryRunner.manager.getRepository(Project);

    const allIds = PROJECTS.flatMap((p) => p.actionIds);
    const actions = await actionRepo.find({
      where: { id: In(allIds) },
      relations: { project: true },
    });
    const byId = new Map(actions.map((a) => [a.id, a]));
    const missing = allIds.filter((id) => !byId.has(id));
    if (missing.length) {
      throw new Error(`actions not found: ${missing.join(", ")}`);
    }

    const conflicts = PROJECTS.flatMap(({ name, actionIds }) =>
      actionIds
        .map((id) => byId.get(id)!)
        .filter((a) => a.project && a.project.name !== name)
        .map((a) => `${a.id} is in "${a.project!.name}", expected "${name}"`),
    );
    if (conflicts.length) {
      throw new Error(`actions in another project:\n${conflicts.join("\n")}`);
    }

    for (const { name, actionIds } of PROJECTS) {
      const existing = await projectRepo.findOneBy({ name });
      const project = existing ?? (await projectRepo.save({ name }));
      const toAssign = actionIds.filter(
        (id) => byId.get(id)!.project?.id !== project.id,
      );
      if (toAssign.length) {
        await actionRepo.update(
          { id: In(toAssign) },
          { project: { id: project.id } },
        );
      }
      console.log(
        `${existing ? "exists " : "created"} ${name}: ` +
          (toAssign.length ? `assigned ${toAssign.join(", ")}` : "no changes"),
      );
    }

    if (apply) {
      await queryRunner.commitTransaction();
    } else {
      await queryRunner.rollbackTransaction();
      console.log("Dry run; pass --apply to write.");
    }
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
