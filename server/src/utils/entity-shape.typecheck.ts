import type { Assert } from '@alliance/common/types';
import type { EntityShape } from './Repository';
import type { ActionPartnershipNote } from 'src/action-partnerships/entities/action-partnership-note.entity';
import type { ActionPartnershipResponse } from 'src/action-partnerships/entities/action-partnership-response.entity';
import type { ActionStatsRecord } from 'src/analytics/actionstats.entity';
import type { AiDetectionResult } from 'src/ai-detection/entities/ai-detection-result.entity';
import type { Campaign } from 'src/campaign/entities/campaign.entity';
import type { City } from 'src/geo/city.entity';
import type { Cluster } from 'src/cluster/entities/cluster.entity';
import type { CustomValidator } from 'src/tasks/entities/customvalidator.entity';
import type { DailyStatsRecord } from 'src/analytics/dailystats.entity';
import type { EditableContent } from 'src/forum/entities/editablecontent.entity';
import type { EventLog } from 'src/eventlog/event-log.entity';
import type { ExternalShareTarget } from 'src/share-urls/entities/external-share-target.entity';
import type { FormSnapshot } from 'src/tasks/entities/formsnapshot.entity';
import type { Guest } from 'src/auth/entities/guest.entity';
import type { Image } from 'src/images/entities/image.entity';
import type { Mail } from 'src/mail/mail.entity';
import type { Mms } from 'src/mms/mms.entity';
import type { PaymentUserDataToken } from 'src/payments/entities/payment-token.entity';
import type { RecentSearch } from 'src/search/recentsearch.entity';
import type { UserAwayRange } from 'src/user/entities/user-away-range.entity';
import type { Video } from 'src/videos/entities/video.entity';

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
  | Assert<EntityShape<ActionPartnershipNote>>
  | Assert<EntityShape<ActionPartnershipResponse>>
  | Assert<EntityShape<ActionStatsRecord>>
  | Assert<EntityShape<AiDetectionResult>>
  | Assert<EntityShape<Campaign>>
  | Assert<EntityShape<City>>
  | Assert<EntityShape<Cluster>>
  | Assert<EntityShape<CustomValidator>>
  | Assert<EntityShape<DailyStatsRecord>>
  | Assert<EntityShape<EditableContent>>
  | Assert<EntityShape<EventLog>>
  | Assert<EntityShape<ExternalShareTarget>>
  | Assert<EntityShape<FormSnapshot>>
  | Assert<EntityShape<Guest>>
  | Assert<EntityShape<Image>>
  | Assert<EntityShape<Mail>>
  | Assert<EntityShape<Mms>>
  | Assert<EntityShape<PaymentUserDataToken>>
  | Assert<EntityShape<RecentSearch>>
  | Assert<EntityShape<UserAwayRange>>
  | Assert<EntityShape<Video>>;
