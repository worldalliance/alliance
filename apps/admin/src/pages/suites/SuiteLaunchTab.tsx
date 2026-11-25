import type { Result } from "@alliance/common/result";
import type {
  ActionSuiteDto,
  CreateActionEventDto,
} from "@alliance/shared/client";
import { Link } from "react-router";
import SuiteLaunchPanel from "../../components/suite-launch/SuiteLaunchPanel";
import { formatDateTime } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { linkClass } from "../../ui/styles";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { LaunchStatus, type SuiteLaunch, suiteDates } from "./suiteRules";

/**
 * Launch: today's launch panel while the suite can launch; otherwise why it
 * can't, in the suite page's words.
 */
export function SuiteLaunchTab({
  suite,
  launch,
  eventsHref,
  addEvent,
  fetchSuite,
  onClose,
}: {
  suite: ActionSuiteDto;
  launch: SuiteLaunch;
  eventsHref: string;
  addEvent: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
  /** Rereads the suite past the cache, so launch checks what the server has. */
  fetchSuite: () => Promise<Result<ActionSuiteDto, unknown>>;
  /** After a launch, or Back to suite. */
  onClose: () => void;
}) {
  switch (launch.status) {
    case LaunchStatus.Ready:
      return (
        <SuiteLaunchPanel
          suite={suite}
          addEvent={addEvent}
          fetchSuite={fetchSuite}
          onClose={onClose}
        />
      );
    case LaunchStatus.Launched: {
      const { membersStart } = suiteDates(suite.events);
      return (
        <Banner inline>
          <p className="font-medium">This suite has launched</p>
          <p>{launch.reason}</p>
          <p className="text-fg-muted">
            {membersStart &&
              `Members start ${formatDateTime(membersStart, { weekday: true, timeZone: LAUNCH_TIME_ZONE })}. `}
            See its{" "}
            <Link to={eventsHref} className={linkClass}>
              events
            </Link>
            .
          </p>
        </Banner>
      );
    }
    case LaunchStatus.Refused:
      return (
        <Banner inline tone={BannerTone.Warning}>
          <p className="font-medium">This suite can't launch</p>
          <p>{launch.reason}</p>
        </Banner>
      );
    default:
      throw new Error(`unknown launch status: ${launch satisfies never}`);
  }
}
