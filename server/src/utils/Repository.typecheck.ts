/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Assert, Equal, Extends } from "@alliance/common/types";
import type {
  EntityShape,
  EntityShapeViolations,
  IsRelation,
  NoRelations,
  NonEmpty,
  Relation,
  RelationBrand,
  Relations,
  Repository,
  WithRelations,
  WithRelationsExact,
} from "./Repository";

type Author = { id: number; email: string };

type Probe = {
  id: number;
  note: string | null;
  author?: Relation<Author>;
  editors?: Relation<Author>[];
};

type _typecheck_IsRelation =
  | Assert<Equal<IsRelation<null>, false>>
  | Assert<Equal<IsRelation<string>, false>>
  | Assert<Equal<IsRelation<number>, false>>
  | Assert<Equal<IsRelation<boolean>, false>>
  | Assert<Equal<IsRelation<Date>, false>>
  | Assert<Equal<IsRelation<number | null>, false>>
  | Assert<Equal<IsRelation<number | undefined>, false>>
  | Assert<Equal<IsRelation<number | null | undefined>, false>>
  | Assert<Equal<IsRelation<{ param: string }>, false>>
  | Assert<Equal<IsRelation<{ param: string } | null>, false>>
  | Assert<Equal<IsRelation<{ param: string }[]>, false>>
  | Assert<Equal<IsRelation<{ theme: string; notifications: boolean }>, false>>
  | Assert<Equal<IsRelation<{ nested: { deep: number } }>, false>>
  | Assert<Equal<IsRelation<{ items: { id: string }[] }>, false>>
  | Assert<Equal<IsRelation<{ kind: "a" } | { kind: "b" }>, false>>
  | Assert<Equal<IsRelation<Record<string, number>>, false>>
  | Assert<Equal<IsRelation<Relation<{ param: string }>>, true>>
  | Assert<Equal<IsRelation<Relation<{ param: number }> | null>, true>>
  | Assert<Equal<IsRelation<Relation<{ param: number }>[] | null>, true>>
  | Assert<Equal<IsRelation<(Relation<{ param: number }> | null)[]>, true>>
  | Assert<
      Equal<IsRelation<(Relation<{ param: number }> | null)[] | null>, true>
    >;

type $EagerEvaluation<T> =
  T extends Array<infer I>
    ? $EagerEvaluation<I>[]
    : T extends Promise<infer I>
      ? Promise<$EagerEvaluation<I>>
      : T extends object
        ? {
            [K in keyof T as K extends RelationBrand
              ? never
              : [T[K]] extends [never]
                ? never
                : K]: $EagerEvaluation<T[K]>;
          }
        : T;

type _typecheck_StripItems =
  | Assert<Equal<$EagerEvaluation<{ param: string }>, { param: string }>>
  | Assert<
      Equal<
        $EagerEvaluation<{ param?: { subparam: string } }>,
        { param?: { subparam: string } }
      >
    >
  | Assert<Equal<$EagerEvaluation<{ param: never }>, {}>>
  | Assert<Equal<$EagerEvaluation<{ param: undefined }>, { param: undefined }>>
  | Assert<Equal<$EagerEvaluation<{ param?: never }>, { param?: never }>>
  | Assert<
      Equal<$EagerEvaluation<{ param?: undefined }>, { param?: undefined }>
    >
  | Assert<Equal<$EagerEvaluation<{ param?: null }>, { param?: null }>>
  | Assert<
      Equal<
        $EagerEvaluation<{ param1?: string; param2: number; param3: never }>,
        { param1?: string; param2: number }
      >
    >
  | Assert<
      Equal<$EagerEvaluation<Relation<{ param: string }>>, { param: string }>
    >
  | never;

type _typecheck_NonEmpty =
  | Assert<Equal<NonEmpty<{}, { test: 123 }>, { test: 123 }>>
  | Assert<Equal<NonEmpty<{}>, never>>
  | Assert<Equal<NonEmpty<{ param: string }>, { param: string }>>;

type _typecheck_Relations =
  | Assert<Equal<Relations<{ param: string }>, {}>>
  | Assert<Equal<Relations<{ param: number[] }>, {}>>
  | Assert<Equal<Relations<{ param: Date }>, {}>>
  | Assert<Equal<Relations<{ param: { subparam: string } }>, {}>>
  | Assert<
      Equal<
        Relations<{ param: Relation<{ subparam: string }> }>,
        { param?: true | undefined }
      >
    >
  | Assert<
      Equal<
        Relations<{ param: Relation<{ subparam: string }>[] }>,
        { param?: true | undefined }
      >
    >
  | Assert<
      Equal<
        Relations<{ param: Promise<Relation<{ subparam: string }>> }>,
        { param?: true | undefined }
      >
    >
  | Assert<
      Equal<
        Relations<{
          param: Relation<{ subparam: Relation<{ subsubparam: string }> }>;
        }>,
        { param?: true | undefined | { subparam?: true | undefined } }
      >
    >
  | Assert<
      Equal<
        Relations<{
          param1: string;
          param2: Relation<{ subparam: string }>;
          param3: Relation<{ subparam: Relation<{ subsubparam: string }> }>;
        }>,
        {
          param2?: true | undefined;
          param3?: true | undefined | { subparam?: true | undefined };
        }
      >
    >
  | Assert<
      Equal<
        Relations<{
          settings: { theme: string; notifications: boolean };
          posts: Relation<{ id: number }>[];
        }>,
        { posts?: true | undefined }
      >
    >
  | Assert<
      Equal<
        Relations<{
          jsonbA: { a: string };
          jsonbB: { b: number }[];
          jsonbC: { c: { nested: boolean } } | null;
        }>,
        {}
      >
    >;

type _typecheck_NoRelations =
  | Assert<Equal<NoRelations<{ param: string }>, { param: string }>>
  | Assert<Equal<NoRelations<{ param?: number }>, { param?: number }>>
  | Assert<Equal<NoRelations<{ param: null }>, { param: null }>>
  | Assert<Equal<NoRelations<{ param: string[] }>, { param: string[] }>>
  | Assert<
      Equal<
        NoRelations<{ param: (string | null)[] }>,
        { param: (string | null)[] }
      >
    >
  | Assert<
      Equal<
        NoRelations<{ param: { subparam: string } }>,
        { param: { subparam: string } }
      >
    >
  | Assert<Equal<NoRelations<{ param: Relation<{ subparam: string }> }>, {}>>
  | Assert<Equal<NoRelations<{ param?: Relation<{ subparam: string }> }>, {}>>
  | Assert<Equal<NoRelations<{ param: Relation<{ subparam: string }>[] }>, {}>>
  | Assert<
      Equal<NoRelations<{ param: Relation<{ subparam: string }>[] | null }>, {}>
    >
  | Assert<
      Equal<
        NoRelations<{
          param: (Relation<{ subparam: string }> | null)[];
        }>,
        {}
      >
    >
  | Assert<
      Equal<NoRelations<{ param: Promise<Relation<{ subparam: string }>> }>, {}>
    >
  | Assert<
      Equal<
        NoRelations<{
          param: Promise<Relation<{ subparam: string }> | null>;
        }>,
        {}
      >
    >
  | Assert<
      Equal<
        NoRelations<{
          param: Promise<Relation<{ subparam: string }>> | null;
        }>,
        {}
      >
    >
  | Assert<
      Equal<
        NoRelations<{ settings: { theme: string; notifications: boolean } }>,
        { settings: { theme: string; notifications: boolean } }
      >
    >
  | Assert<
      Equal<
        NoRelations<{
          settings: { theme: string };
          posts: Relation<{ id: number }>[];
        }>,
        { settings: { theme: string } }
      >
    >
  | Assert<
      Equal<
        NoRelations<{ items: { id: string; label: string }[] | null }>,
        { items: { id: string; label: string }[] | null }
      >
    >;

type _typecheck_WithRelationsExact =
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param: string;
            },
            {}
          >
        >,
        { param: string }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: number;
            },
            {}
          >
        >,
        { param?: number }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Relation<{ subparam: string }>;
            },
            {}
          >
        >,
        {
          param?: undefined;
        }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Relation<{ subparam: string }>;
            },
            { param: undefined }
          >
        >,
        {
          param?: undefined;
        }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Relation<{ subparam: string }>;
            },
            { param: true }
          >
        >,
        { param: { subparam: string } }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Relation<{ subparam: string }>;
            },
            { param: true }
          >
        >,
        { param: { subparam: string } }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Relation<{ subparam: string }>[];
            },
            { param: true }
          >
        >,
        { param: { subparam: string }[] }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Relation<{ subparam: string }>[];
            },
            { param: true }
          >
        >,
        { param: { subparam: string }[] }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: (Relation<{ subparam: string }> | null)[];
            },
            { param: true }
          >
        >,
        { param: ({ subparam: string } | null)[] }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param: Promise<Relation<{ subparam: string }>>;
            },
            { param: true }
          >
        >,
        { param: Promise<{ subparam: string }> }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Promise<Relation<{ subparam: string }>>;
            },
            { param: true }
          >
        >,
        { param: Promise<{ subparam: string }> }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Promise<Relation<{ subparam: string }> | null>;
            },
            { param: true }
          >
        >,
        { param: Promise<{ subparam: string } | null> }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Relation<{
                subparam: string;
                subparam2?: Relation<{ subsubparam: string }>;
              }>;
            },
            { param: true }
          >
        >,
        { param: { subparam: string; subparam2?: undefined } }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Relation<{
                subparam: string;
                subparam2?: Relation<{ subsubparam: string }>;
              }>;
            },
            { param: { subparam2: undefined } }
          >
        >,
        { param: { subparam: string; subparam2?: undefined } }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Relation<{
                subparam: string;
                subparam2?: Relation<{ subsubparam: string }>;
              }>;
            },
            { param: { subparam2: true } }
          >
        >,
        { param: { subparam: string; subparam2: { subsubparam: string } } }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              param?: Relation<{
                subparam1: string;
                subparam2?: Relation<{ subsubparam: string }>;
              }>;
            },
            { param: true }
          >
        >,
        { param: { subparam1: string; subparam2?: undefined } }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              settings: { theme: string; notifications: boolean };
              posts?: Relation<{ id: number; title: string }>[];
            },
            { posts: true }
          >
        >,
        {
          settings: { theme: string; notifications: boolean };
          posts: { id: number; title: string }[];
        }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelationsExact<
            {
              settings: { theme: string };
              posts?: Relation<{ id: number }>[];
            },
            {}
          >
        >,
        { settings: { theme: string }; posts?: undefined }
      >
    >;

type _typecheck_WithRelations =
  | Assert<
      Equal<
        $EagerEvaluation<WithRelations<{ param: string }, {}>>,
        { param: string }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelations<{ param?: Relation<{ subparam: string }> }, {}>
        >,
        { param?: { subparam: string } }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelations<
            { param?: Relation<{ subparam: string }> },
            { param: true }
          >
        >,
        { param: { subparam: string } }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelations<
            {
              requiredRel?: Relation<{ a: string }>;
              otherRel?: Relation<{ b: number }>;
            },
            { requiredRel: true }
          >
        >,
        { requiredRel: { a: string }; otherRel?: { b: number } }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelations<
            {
              settings: { theme: string };
              posts?: Relation<{ id: number }>[];
              tags?: Relation<{ name: string }>[];
            },
            { posts: true }
          >
        >,
        {
          settings: { theme: string };
          posts: { id: number }[];
          tags?: { name: string }[];
        }
      >
    >
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelations<
            {
              param?: Relation<{
                subparam: string;
                subRel?: Relation<{ deep: number }>;
                subOther?: Relation<{ extra: boolean }>;
              }>;
            },
            { param: { subRel: true } }
          >
        >,
        {
          param: {
            subparam: string;
            subRel: { deep: number };
            subOther?: { extra: boolean };
          };
        }
      >
    >
  // nullable relation: optional still preserves null
  | Assert<
      Equal<
        $EagerEvaluation<
          WithRelations<{ parent?: Relation<{ id: number }> | null }, {}>
        >,
        { parent?: { id: number } | null }
      >
    >
  // WithRelationsExact<E, R> is assignable to WithRelations<E, R>:
  // the strict return type satisfies the loose input type
  | Assert<
      Extends<
        WithRelationsExact<
          {
            settings: { theme: string };
            posts?: Relation<{ id: number }>[];
            tags?: Relation<{ name: string }>[];
          },
          { posts: true }
        >,
        WithRelations<
          {
            settings: { theme: string };
            posts?: Relation<{ id: number }>[];
            tags?: Relation<{ name: string }>[];
          },
          { posts: true }
        >
      >
    >
  // and loading more than required still satisfies the loose input type
  | Assert<
      Extends<
        WithRelationsExact<
          {
            posts?: Relation<{ id: number }>[];
            tags?: Relation<{ name: string }>[];
          },
          { posts: true; tags: true }
        >,
        WithRelations<
          {
            posts?: Relation<{ id: number }>[];
            tags?: Relation<{ name: string }>[];
          },
          { posts: true }
        >
      >
    >;

type WellShapedEntity = {
  id: number;
  note: string | null;
  settings: { theme: string };
  user?: Relation<{ id: number }>;
  posts?: Relation<{ id: number }>[];
  parent?: Relation<{ id: number }> | null;
};

type _typecheck_EntityShape =
  | Assert<EntityShape<WellShapedEntity>>
  | Assert<Equal<EntityShapeViolations<WellShapedEntity>, never>>
  | Assert<
      Equal<EntityShapeViolations<{ user: Relation<{ id: number }> }>, "user">
    >
  | Assert<Equal<EntityShapeViolations<{ note?: string }>, "note">>
  | Assert<
      Equal<
        EntityShapeViolations<{ parent: Relation<{ id: number }> | null }>,
        "parent"
      >
    >
  // a well-shaped entity round-trips: query results stay assignable to the
  // entity type, so they still flow into save/remove and entity-typed helpers
  | Assert<Extends<WithRelationsExact<WellShapedEntity, {}>, WellShapedEntity>>
  | Assert<
      Extends<
        WithRelationsExact<WellShapedEntity, { user: true; posts: true }>,
        WellShapedEntity
      >
    >;

/**
 * Exercises real inference through the repository signatures rather than
 * restating them. Never called — it only has to compile.
 */
async function _typecheck_Repository(repo: Repository<Probe>) {
  // Omitting `relations` must resolve the type parameter to `{}`. Without a
  // default it falls back to the constraint, making every result a union over
  // every possible loading.
  const _unspecified = await repo.find({ where: { id: 1 } });
  type _1 = Assert<Equal<(typeof _unspecified)[number]["author"], undefined>>;
  type _2 = Assert<Extends<(typeof _unspecified)[number], Probe>>;

  const _loaded = await repo.findOneOrFail({
    where: { id: 1 },
    relations: { author: true },
  });
  type _3 = Assert<Equal<(typeof _loaded)["author"]["email"], string>>;
  type _4 = Assert<Equal<(typeof _loaded)["editors"], undefined>>;
  type _5 = Assert<Extends<typeof _loaded, Probe>>;

  // The `*By` methods can't request relations, so only eager ones are loaded.
  const _by = await repo.findBy({ id: 1 });
  type _6 = Assert<Equal<(typeof _by)[number]["author"], undefined>>;

  const _oneBy = await repo.findOneBy({ id: 1 });
  type _7 = Assert<Extends<null, typeof _oneBy>>;

  const _oneByOrFail = await repo.findOneByOrFail({ id: 1 });
  type _8 = Assert<Equal<(typeof _oneByOrFail)["editors"], undefined>>;

  const _byIds = await repo.findByIds([1, 2]);
  type _9 = Assert<Equal<(typeof _byIds)[number]["author"], undefined>>;

  const [_rows, _count] = await repo.findAndCount({
    where: { id: 1 },
    relations: { editors: true },
  });
  type _10 = Assert<Extends<(typeof _rows)[number]["editors"][number], Author>>;
  type _11 = Assert<Equal<(typeof _rows)[number]["author"], undefined>>;
  type _12 = Assert<Equal<typeof _count, number>>;

  const [_countedBy] = await repo.findAndCountBy({ id: 1 });
  type _13 = Assert<Equal<(typeof _countedBy)[number]["author"], undefined>>;

  // `find` and `findAndCount` take no arguments in TypeORM; keeping that
  // spelling means adopting this type never forces a meaningless `find({})`.
  const _all = await repo.find();
  type _14 = Assert<Equal<(typeof _all)[number]["author"], undefined>>;

  const [_allRows] = await repo.findAndCount();
  type _15 = Assert<Extends<(typeof _allRows)[number], Probe>>;
}

type NestedProbe = {
  id: number;
  editors?: Relation<{ id: number; boss?: Relation<Author> }>[];
};

/**
 * A loaded to-many relation must stay exact however it is iterated, not just
 * when indexed. Never called — it only has to compile.
 */
async function _typecheck_ToManyExactness(repo: Repository<NestedProbe>) {
  const [row] = await repo.find({ relations: { editors: true } });

  type _1 = Assert<Equal<(typeof row)["editors"][number]["boss"], undefined>>;

  row.editors.map((_editor) => {
    type _2 = Assert<Equal<(typeof _editor)["boss"], undefined>>;
  });

  row.editors.forEach((_editor) => {
    type _3 = Assert<Equal<(typeof _editor)["boss"], undefined>>;
  });

  const _found = row.editors.find(() => true);
  type _4 = Assert<Equal<NonNullable<typeof _found>["boss"], undefined>>;

  for (const _editor of row.editors) {
    type _5 = Assert<Equal<(typeof _editor)["boss"], undefined>>;
  }
}

class ClassProbe {
  id: number;
  editors?: Relation<Author>[];
  private cache: Map<number, boolean>;
}

// Entities are classes, and several carry private members. Mapping over
// `keyof Entity` drops those, so the intersection has to keep `Entity` itself
// for results to stay assignable back to the entity type.
type _typecheck_PrivateMemberRoundTrip =
  | Assert<Extends<WithRelationsExact<ClassProbe, {}>, ClassProbe>>
  | Assert<
      Extends<WithRelationsExact<ClassProbe, { editors: true }>, ClassProbe>
    >;

// A misshapen entity resolves to its violation rather than to a repository, so
// the compile error names the field instead of surfacing as `never` rows.
type _typecheck_RepositoryRejectsUnshapedEntity =
  | Assert<Extends<Repository<Probe>, { find: unknown }>>
  | Assert<
      Equal<
        Repository<{ id: number; author: Relation<Author> }>,
        { author: "must be optional if and only if it is a relation" }
      >
    >
  | Assert<
      Equal<
        Repository<{ id: number; note?: string }>,
        { note: "must be optional if and only if it is a relation" }
      >
    >;
