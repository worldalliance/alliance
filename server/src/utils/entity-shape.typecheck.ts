import type { Assert } from '@alliance/common/types';
import type { EntityShape } from './Repository';
import type { ActionPartnershipResponse } from 'src/action-partnerships/entities/action-partnership-response.entity';
import type { Campaign } from 'src/campaign/entities/campaign.entity';
import type { City } from 'src/geo/city.entity';
import type { Cluster } from 'src/cluster/entities/cluster.entity';
import type { DailyStatsRecord } from 'src/analytics/dailystats.entity';
import type { EditableContent } from 'src/forum/entities/editablecontent.entity';
import type { ExternalShareTarget } from 'src/share-urls/entities/external-share-target.entity';
import type { FormSnapshot } from 'src/tasks/entities/formsnapshot.entity';
import type { Guest } from 'src/auth/entities/guest.entity';
import type { Image } from 'src/images/entities/image.entity';
import type { PaymentUserDataToken } from 'src/payments/entities/payment-token.entity';
import type { RecentSearch } from 'src/search/recentsearch.entity';
import type { UserAwayRange } from 'src/user/entities/user-away-range.entity';

/**
 * Entities that have been migrated to the convention enforced by
 * {@link EntityShape}: a field is optional if and only if it is a relation.
 *
 * Add an entity here once its relations are optional and its nullable columns
 * use `| null`, so the shape can't regress. Entities missing from this list
 * haven't been migrated yet.
 *
 * The `Repository` type already enforces this; listing an entity here pins its
 * shape independently, and reports a violation against the entity rather than
 * against whichever service calls it first.
 */
type _typecheck_EntityShapes =
  | Assert<EntityShape<ActionPartnershipResponse>>
  | Assert<EntityShape<Campaign>>
  | Assert<EntityShape<City>>
  | Assert<EntityShape<Cluster>>
  | Assert<EntityShape<DailyStatsRecord>>
  | Assert<EntityShape<EditableContent>>
  | Assert<EntityShape<ExternalShareTarget>>
  | Assert<EntityShape<FormSnapshot>>
  | Assert<EntityShape<Guest>>
  | Assert<EntityShape<Image>>
  | Assert<EntityShape<PaymentUserDataToken>>
  | Assert<EntityShape<RecentSearch>>
  | Assert<EntityShape<UserAwayRange>>;
