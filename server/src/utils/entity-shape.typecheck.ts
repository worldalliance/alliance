import type { Assert } from '@alliance/common/types';
import type { EntityShape } from './Repository';
import type { UserAwayRange } from 'src/user/entities/user-away-range.entity';

/**
 * Entities that have been migrated to the convention enforced by
 * {@link EntityShape}: a field is optional if and only if it is a relation.
 *
 * Add an entity here once its relations are optional and its nullable columns
 * use `| null`, so the shape can't regress. Entities missing from this list
 * haven't been migrated yet.
 */
type _typecheck_EntityShapes = Assert<EntityShape<UserAwayRange>>;
