import type {
  EntityManager,
  EntityTarget,
  FindManyOptions,
  ObjectLiteral,
  SelectQueryBuilder,
} from "typeorm";

/**
 * A find that includes deleted `target` rows while its relations still leave
 * deleted rows out.
 */
export function findWithDeletedRoot<T extends ObjectLiteral>(
  manager: EntityManager,
  params: { target: EntityTarget<T>; options: FindManyOptions<T> },
): SelectQueryBuilder<T> {
  // withDeleted after setFindOptions' joins: TypeORM adds a join's deletedAt
  // filter only while withDeleted is unset.
  return manager
    .createQueryBuilder(params.target, "root")
    .setFindOptions(params.options)
    .withDeleted();
}
