import type { Result } from "@alliance/common/result";
import type {
  ActionSuiteDto,
  CreateActionEventDto,
} from "@alliance/shared/client";
import { Link } from "react-router";
import { formatDateTime } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { linkClass } from "../../ui/styles";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import SuiteLaunchPanel from "./launch/SuiteLaunchPanel";
import { LaunchStatus, type SuiteLaunch, suiteDates } from "./suiteRules";

/**
 * Launch: the checks and the launch while the suite can launch; otherwise
 * why it can't, in the words the suite record's header uses, and no button.
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
  /** After a launch. */
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
        <div className="max-w-176">
          <Banner inline>
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">This suite has launched</h2>
              <p>{launch.reason}</p>
              {membersStart && (
                <p>
                  Members start{" "}
                  {formatDateTime(membersStart, {
                    weekday: true,
                    timeZone: LAUNCH_TIME_ZONE,
                  })}
                  .
                </p>
              )}
              <p>
                <Link to={eventsHref} className={linkClass}>
                  See its events
                </Link>
              </p>
            </div>
          </Banner>
        </div>
      );
    }
    case LaunchStatus.Refused:
      return (
        <div className="max-w-176">
          <Banner inline tone={BannerTone.Warning}>
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">This suite can't launch</h2>
              <p>{launch.reason}</p>
              {!suite.isPartitioned && (
                <p>
                  <Link to={eventsHref} className={linkClass}>
                    Open the suite's events
                  </Link>
                </p>
              )}
            </div>
          </Banner>
        </div>
      );
    default:
      throw new Error(`unknown launch status: ${launch satisfies never}`);
  }
}
