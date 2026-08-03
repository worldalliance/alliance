/* eslint-disable @typescript-eslint/no-empty-object-type */
import {
  ObjectLiteral,
  type Repository as TypeOrmRepository,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
} from 'typeorm';

declare const relationBrand: unique symbol;
export type RelationBrand = typeof relationBrand;
export type Relation<T> = T & { [relationBrand]?: undefined };

type NonNullableIsRelation<T> = [T] extends [never]
  ? false
  : [T] extends [Promise<infer I>]
    ? IsRelation<I>
    : [T] extends [Array<infer I>]
      ? IsRelation<I>
      : typeof relationBrand extends keyof T
        ? true
        : false;
export type IsRelation<T> = NonNullableIsRelation<NonNullable<T>>;
/**
 * @param T - The type to check for emptiness
 * @param Default - The default value to return if `T` is empty
 *
 * @returns `Default` if, `T` is `{}`. Otherwise `T`.
 */
export type NonEmpty<T, Default = never> = [keyof T] extends [never]
  ? Default
  : T;
type RelationsProperty<Property> =
  Property extends Promise<infer I>
    ? RelationsProperty<NonNullable<I>>
    : Property extends Array<infer I>
      ? RelationsProperty<NonNullable<I>>
      : IsRelation<Property> extends false
        ? never
        : true | NonEmpty<Relations<Property>>;
export type Relations<Entity> = {
  [P in keyof Entity as IsRelation<Entity[P]> extends true
    ? P
    : never]?: RelationsProperty<NonNullable<Entity[P]>>;
};
export type NoRelations<Entity> = {
  [K in keyof Entity as IsRelation<Entity[K]> extends false
    ? K
    : never]: IsRelation<Entity[K]> extends false ? Entity[K] : never;
};
type ResolveRelationPropExact<Prop, R> =
  Prop extends Promise<infer I>
    ? Promise<
        ResolveRelationPropExact<NonNullable<I>, R> | (I & (null | undefined))
      >
    : Prop extends Array<infer I>
      ? Array<
          ResolveRelationPropExact<NonNullable<I>, R> | (I & (null | undefined))
        >
      : IsRelation<Prop> extends true
        ? R extends true
          ? WithRelationsExact<Prop, {}>
          : R extends Relations<Prop>
            ? WithRelationsExact<Prop, R>
            : never
        : never;
/**
 * The entity with the specified relations loaded and all other relations
 * forced to `undefined`. Use this as the return type of a method that loads
 * exactly the relations the caller asked for.
 *
 * Contrast with {@link WithRelations}, which leaves the unspecified relations optional.
 */
export type WithRelationsExact<Entity, R extends Relations<Entity>> = {
  [K in keyof Entity as K extends keyof Relations<Entity>
    ? K extends keyof R
      ? R[K] extends undefined
        ? never
        : K
      : never
    : never]-?: K extends keyof R
    ?
        | ResolveRelationPropExact<NonNullable<Entity[K]>, R[K]>
        | (Entity[K] & null)
    : never;
} & {
  [K in keyof Entity as K extends keyof Relations<Entity>
    ? K extends keyof R
      ? R[K] extends undefined
        ? K
        : never
      : K
    : never]: undefined;
} & Entity;
type ResolveRelationProp<Prop, R> =
  Prop extends Promise<infer I>
    ? Promise<ResolveRelationProp<NonNullable<I>, R> | (I & (null | undefined))>
    : Prop extends Array<infer I>
      ? Array<ResolveRelationProp<NonNullable<I>, R> | (I & (null | undefined))>
      : IsRelation<Prop> extends true
        ? R extends true
          ? WithRelations<Prop, {}>
          : R extends Relations<Prop>
            ? WithRelations<Prop, R>
            : never
        : never;

/**
 * The entity with the specified relations required to be loaded, and all other
 * relations optionally loaded. Use this to type inputs of functions that
 * require certain relations but don't care whether additional ones are present.
 *
 * Contrast with {@link WithRelationsExact}, which requires all unspecified relations to be absent.
 */
export type WithRelations<Entity, R extends Relations<Entity>> = {
  [K in keyof Entity as K extends keyof Relations<Entity>
    ? K extends keyof R
      ? R[K] extends undefined
        ? never
        : K
      : never
    : never]-?: K extends keyof R
    ? ResolveRelationProp<NonNullable<Entity[K]>, R[K]> | (Entity[K] & null)
    : never;
} & {
  [K in keyof Entity as K extends keyof Relations<Entity>
    ? K extends keyof R
      ? R[K] extends undefined
        ? K
        : never
      : K
    : never]?: Entity[K];
} & Entity;
type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

type RelationKeys<T> = {
  [K in keyof T]-?: IsRelation<T[K]> extends true ? K : never;
}[keyof T];

/**
 * Keys that break the entity convention: a field is optional if and only if it
 * is a relation, so `undefined` unambiguously means "not loaded". Everything
 * else is required and spells absence as `| null`.
 *
 * The convention is what makes `undefined` meaningful. A violating entity has
 * no usable shape: the mapped types intersect `Entity`, so a required relation
 * meets the `undefined` standing for "not loaded" and the whole entity type
 * reduces to `never`. {@link Repository} rejects such entities up front rather
 * than handing out `never` rows.
 */
export type EntityShapeViolations<Entity> =
  | Exclude<RelationKeys<Entity>, OptionalKeys<Entity>>
  | Exclude<OptionalKeys<Entity>, RelationKeys<Entity>>;

/**
 * `true` when `Entity` follows the convention, otherwise a type naming the
 * offending fields. {@link Repository} gates on this, so an entity with a typed
 * repository is already checked; assert it from `entity-shape.typecheck.ts` to
 * pin an entity's shape ahead of that.
 */
export type EntityShape<Entity> = [EntityShapeViolations<Entity>] extends [
  never,
]
  ? true
  : {
      [K in EntityShapeViolations<Entity>]: 'must be optional if and only if it is a relation';
    };

type ShapedRepository<Entity extends ObjectLiteral> = Omit<
  TypeOrmRepository<Entity>,
  | 'find'
  | 'findOne'
  | 'findOneOrFail'
  | 'findBy'
  | 'findOneBy'
  | 'findOneByOrFail'
  | 'findAndCount'
  | 'findAndCountBy'
  | 'findByIds'
> & {
  find<R extends Relations<Entity> = {}>(
    options?: FindManyOptions<Entity> & { relations?: R },
  ): Promise<WithRelationsExact<Entity, R>[]>;

  findOne<R extends Relations<Entity> = {}>(
    options: FindOneOptions<Entity> & { relations?: R },
  ): Promise<WithRelationsExact<Entity, R> | null>;

  findOneOrFail<R extends Relations<Entity> = {}>(
    options: FindOneOptions<Entity> & { relations?: R },
  ): Promise<WithRelationsExact<Entity, R>>;

  findAndCount<R extends Relations<Entity> = {}>(
    options?: FindManyOptions<Entity> & { relations?: R },
  ): Promise<[WithRelationsExact<Entity, R>[], number]>;

  // The `*By` overloads take a bare `where`, so relations can't be requested.

  findBy(
    where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[],
  ): Promise<WithRelationsExact<Entity, {}>[]>;

  findAndCountBy(
    where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[],
  ): Promise<[WithRelationsExact<Entity, {}>[], number]>;

  findOneBy(
    where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[],
  ): Promise<WithRelationsExact<Entity, {}> | null>;

  findOneByOrFail(
    where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[],
  ): Promise<WithRelationsExact<Entity, {}>>;

  /** @deprecated use `findBy` with the `In` operator instead. */
  findByIds(ids: unknown[]): Promise<WithRelationsExact<Entity, {}>[]>;
};

/**
 * Adoption caveat: relations declared `eager: true` are loaded at runtime by
 * every find method — `loadEagerRelations` defaults to true — but typed as
 * unloaded here. Resolve those relations before typing a repository with this.
 *
 * An entity that breaks the {@link EntityShapeViolations} convention resolves
 * to the violation itself instead of a repository, so the first call against it
 * reports the offending field rather than failing somewhere downstream.
 */
export type Repository<Entity extends ObjectLiteral> =
  EntityShape<Entity> extends true
    ? ShapedRepository<Entity>
    : EntityShape<Entity>;
