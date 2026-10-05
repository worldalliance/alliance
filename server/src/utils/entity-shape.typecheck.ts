import type { Assert } from "@alliance/common/types";
import type { ActionPartnershipNote } from "src/action-partnerships/entities/action-partnership-note.entity";
import type { ActionPartnershipResponse } from "src/action-partnerships/entities/action-partnership-response.entity";
import type { ActionFormAssignment } from "src/actions/entities/action-form-assignment.entity";
import type { ActionFormVariant } from "src/actions/entities/action-form-variant.entity";
import type { FollowUpForm } from "src/actions/entities/follow-up-form.entity";
import type { GeneralUpdateActivity } from "src/actions/entities/general-update-activity.entity";
import type { AiDetectionResult } from "src/ai-detection/entities/ai-detection-result.entity";
import type { ActionStatsRecord } from "src/analytics/actionstats.entity";
import type { DailyStatsRecord } from "src/analytics/dailystats.entity";
import type { Guest } from "src/auth/entities/guest.entity";
import type { Campaign } from "src/campaign/entities/campaign.entity";
import type { Cluster } from "src/cluster/entities/cluster.entity";
import type { Contract } from "src/contract/entities/contract.entity";
import type { EventLog } from "src/eventlog/event-log.entity";
import type { EditableContent } from "src/forum/entities/editablecontent.entity";
import type { City } from "src/geo/city.entity";
import type { Mail } from "src/mail/mail.entity";
import type { Mms } from "src/mms/mms.entity";
import type { ActionEventNotif } from "src/notifs/entities/action-event-notif.entity";
import type { UnreadContent } from "src/notifs/entities/unread-content.entity";
import type { Push } from "src/push/push.entity";
import type { RecentSearch } from "src/search/recentsearch.entity";
import type { ExternalShareTarget } from "src/share-urls/entities/external-share-target.entity";
import type { CustomValidator } from "src/tasks/entities/customvalidator.entity";
import type { FormSnapshot } from "src/tasks/entities/formsnapshot.entity";
import type { AmbassadorInviteGoal } from "src/user/entities/ambassador-invite-goal.entity";
import type { AmbassadorProgramInteraction } from "src/user/entities/ambassador-program-interaction.entity";
import type { AmbassadorProgramMember } from "src/user/entities/ambassador-program-member.entity";
import type { ContractEvent } from "src/user/entities/contract-event.entity";
import type { Friend } from "src/user/entities/friend.entity";
import type { UserAwayRange } from "src/user/entities/user-away-range.entity";
import type { UserDevice } from "src/user/entities/user-device.entity";
import type { Video } from "src/videos/entities/video.entity";
import type { EntityShape } from "./Repository";

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
  | Assert<EntityShape<ActionEventNotif>>
  | Assert<EntityShape<ActionFormAssignment>>
  | Assert<EntityShape<ActionFormVariant>>
  | Assert<EntityShape<ActionPartnershipNote>>
  | Assert<EntityShape<ActionPartnershipResponse>>
  | Assert<EntityShape<ActionStatsRecord>>
  | Assert<EntityShape<AiDetectionResult>>
  | Assert<EntityShape<AmbassadorInviteGoal>>
  | Assert<EntityShape<AmbassadorProgramInteraction>>
  | Assert<EntityShape<AmbassadorProgramMember>>
  | Assert<EntityShape<Campaign>>
  | Assert<EntityShape<City>>
  | Assert<EntityShape<Cluster>>
  | Assert<EntityShape<Contract>>
  | Assert<EntityShape<ContractEvent>>
  | Assert<EntityShape<CustomValidator>>
  | Assert<EntityShape<DailyStatsRecord>>
  | Assert<EntityShape<EditableContent>>
  | Assert<EntityShape<EventLog>>
  | Assert<EntityShape<ExternalShareTarget>>
  | Assert<EntityShape<FollowUpForm>>
  | Assert<EntityShape<FormSnapshot>>
  | Assert<EntityShape<Friend>>
  | Assert<EntityShape<GeneralUpdateActivity>>
  | Assert<EntityShape<Guest>>
  | Assert<EntityShape<Mail>>
  | Assert<EntityShape<Mms>>
  | Assert<EntityShape<Push>>
  | Assert<EntityShape<RecentSearch>>
  | Assert<EntityShape<UnreadContent>>
  | Assert<EntityShape<UserAwayRange>>
  | Assert<EntityShape<UserDevice>>
  | Assert<EntityShape<Video>>;
