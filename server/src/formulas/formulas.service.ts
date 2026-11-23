import { printNames } from "@alliance/common/expression/check";
import { reads } from "@alliance/common/expression/dependencies";
import {
  checkNamedSave,
  type SaveProblem,
} from "@alliance/common/expression/named";
import { printExpression } from "@alliance/common/expression/print";
import type { Expr } from "@alliance/common/expression/tree";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { isEqual } from "es-toolkit";
import { lockUntilCommit } from "src/datasources/advisory-lock";
import { MemberList } from "src/member-lists/entities/member-list.entity";
import {
  LIST_CHANGED,
  currentLists,
  deletedListNames,
} from "src/member-lists/member-list-store";
import { DataSource, In, type EntityManager } from "typeorm";
import type { FormulaDtoArgs, FormulaVersionDtoArgs } from "./dto/formula.dto";
import {
  FormulaVersion,
  parseFormulaVersion,
} from "./entities/formula-version.entity";
import { Formula } from "./entities/formula.entity";
import { catalogWith, formulaCatalog } from "./formula-catalog";
import {
  FORMULAS_LOCK,
  asNamed,
  currentFormulas,
  type CurrentFormula,
} from "./formula-store";

/** `baseVersionId` is the version the admin edited, `null` for a new formula. */
export type FormulaEdit = {
  id: string;
  baseVersionId: number | null;
  name: string;
  text: string;
  notes: string | null;
};

export type FormulaDeletion = { id: string; baseVersionId: number };

/** A member list to delete; `baseVersionId` is the membership the admin saw. */
export type ListDeletion = { id: string; baseVersionId: number };

@Injectable()
export class FormulasService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(): Promise<FormulaDtoArgs[]> {
    const manager = this.dataSource.manager;
    const current = await currentFormulas(manager);
    const catalog = await formulaCatalog(manager);
    const names = printNames({
      scope: { catalog, named: current.map(asNamed) },
    });
    return current.map((each) => ({
      ...each,
      text: printExpression(each.version.tree, names),
      reads: [...reads(each.version.tree, []).named],
    }));
  }

  /** Newest first, printed with the names formulas have now. */
  async versions(formulaId: string): Promise<FormulaVersionDtoArgs[]> {
    const manager = this.dataSource.manager;
    const versions = await manager.find(FormulaVersion, {
      where: { formulaId },
      relations: { savedBy: true },
      order: { id: "DESC" },
    });
    // A formula always has a version, so none means no such formula.
    if (versions.length === 0) throw new NotFoundException();
    const current = await currentFormulas(manager);
    const deleted = await manager
      .createQueryBuilder(Formula, "formula")
      .withDeleted()
      .where('formula."deletedAt" IS NOT NULL')
      .getMany();
    const names = printNames({
      scope: {
        catalog: await formulaCatalog(manager),
        named: current.map(asNamed),
      },
      deletedNames: new Map(deleted.map(({ id, name }) => [id, name])),
      deletedLists: await deletedListNames(manager),
    });
    return versions.map((version) => ({
      version,
      text: printExpression(parseFormulaVersion(version).tree, names),
      savedByName: version.savedBy?.name ?? null,
    }));
  }

  /**
   * Saves `edits` and deletes `deletions` and `deletedLists` together, or
   * returns why the check refused them and writes nothing. Throws
   * `ConflictException` when a formula or list changed since the admin opened
   * the version they edited.
   */
  async save({
    edits,
    deletions,
    deletedLists,
    savedById,
  }: {
    edits: FormulaEdit[];
    deletions: FormulaDeletion[];
    deletedLists: ListDeletion[];
    savedById: number;
  }): Promise<SaveProblem[]> {
    const ids = [...edits, ...deletions].map((each) => each.id);
    if (new Set(ids).size < ids.length) {
      throw new BadRequestException(
        "A formula appears more than once in this save.",
      );
    }
    return this.dataSource.transaction(async (manager) => {
      // The check reads every formula, so saves take turns.
      await lockUntilCommit(manager, FORMULAS_LOCK);
      const current = await currentFormulas(manager);
      const existing = await manager.find(Formula, {
        where: { id: In(ids) },
        withDeleted: true,
      });

      assertBases({ current, existing, edits, deletions });
      const listIds = deletedLists.map((each) => each.id);
      if (listIds.length > 0) {
        // Holds off a membership save, so the base check below stays true.
        await manager.find(MemberList, {
          where: { id: In(listIds) },
          lock: { mode: "pessimistic_write" },
        });
      }
      const lists = await currentLists(manager);
      assertListBases(lists, deletedLists);
      const checked = checkNamedSave({
        catalog: catalogWith(
          lists.filter((list) => !listIds.includes(list.id)),
        ),
        named: current.map(asNamed),
        save: edits.map(({ id, name, text }) => ({ id, name, source: text })),
        deleted: deletions.map((deletion) => deletion.id),
        deletedLists: lists.filter((list) => listIds.includes(list.id)),
      });
      if (!checked.ok) return checked.error;

      const byId = new Map(current.map((each) => [each.formula.id, each]));
      const changed = edits.flatMap((edit, i) => {
        const tree = checked.value.named[i].tree;
        const before = byId.get(edit.id)?.version;
        return before !== undefined &&
          before.name === edit.name &&
          before.notes === edit.notes &&
          isEqual(before.tree, tree)
          ? []
          : [{ ...edit, tree }];
      });
      await write({ manager, changed, deletions, savedById });
      if (listIds.length > 0) {
        await manager.softDelete(MemberList, { id: In(listIds) });
      }
      return [];
    });
  }
}

function assertBases({
  current,
  existing,
  edits,
  deletions,
}: {
  current: CurrentFormula[];
  existing: Formula[];
  edits: FormulaEdit[];
  deletions: FormulaDeletion[];
}): void {
  const latest = new Map(
    current.map((each) => [each.formula.id, each.version.id]),
  );
  // Named as stored, since an edit's name may be an unsaved rename.
  const names = new Map(existing.map(({ id, name }) => [id, name]));
  for (const { id, baseVersionId } of [...edits, ...deletions]) {
    const name = names.get(id);
    const label = name === undefined ? "A formula" : `\`${name}\``;
    if (baseVersionId === null) {
      if (name !== undefined) {
        throw new ConflictException(
          `${label} was already saved. Reload to see it.`,
        );
      }
    } else if (!latest.has(id)) {
      throw new ConflictException(
        `${label} was deleted since you opened it. Reload to see the formulas as they are now.`,
      );
    } else if (latest.get(id) !== baseVersionId) {
      throw new ConflictException(
        `${label} was changed since you opened it. Reload to see the latest version.`,
      );
    }
  }
}

function assertListBases(
  lists: readonly { id: string; versionId: number }[],
  deletedLists: readonly ListDeletion[],
): void {
  if (new Set(deletedLists.map(({ id }) => id)).size < deletedLists.length) {
    throw new BadRequestException(
      "A list appears more than once in this save.",
    );
  }
  for (const { id, baseVersionId } of deletedLists) {
    const versionId = lists.find((list) => list.id === id)?.versionId;
    if (versionId === undefined) {
      throw new ConflictException(
        "This list was deleted since you opened it. Reload to see the lists as they are now.",
      );
    }
    if (versionId !== baseVersionId) {
      throw new ConflictException(LIST_CHANGED);
    }
  }
}

async function write({
  manager,
  changed,
  deletions,
  savedById,
}: {
  manager: EntityManager;
  changed: (FormulaEdit & { tree: Expr })[];
  deletions: FormulaDeletion[];
  savedById: number;
}): Promise<void> {
  // A name a deletion frees can be taken in the same save.
  if (deletions.length > 0) {
    await manager.softDelete(Formula, {
      id: In(deletions.map((deletion) => deletion.id)),
    });
  }
  // Renames go through a free name first, so two formulas can swap names.
  // A new formula is inserted, so an id that is taken fails instead of
  // overwriting.
  for (const { id, baseVersionId } of changed) {
    const name = `__renaming:${id}`;
    await (baseVersionId === null
      ? manager.insert(Formula, { id, name })
      : manager.update(Formula, { id }, { name }));
  }
  for (const { id, name, notes, tree } of changed) {
    await manager.update(Formula, { id }, { name });
    await manager.insert(FormulaVersion, {
      formulaId: id,
      name,
      notes,
      tree,
      savedById,
    });
  }
}
