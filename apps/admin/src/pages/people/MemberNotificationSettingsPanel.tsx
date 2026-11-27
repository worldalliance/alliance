import type { PreferenceSource } from "@alliance/shared/client/types.gen";
import {
  CHANNEL_LABEL,
  CHANNELS,
  defaultOf,
} from "@alliance/shared/lib/notificationSettings";
import { formatCount } from "../../lib/formatNumber";
import { useNotificationSettingsAdmin } from "../../lib/useNotificationSettingsAdmin";
import Badge, { BadgeTone } from "../../ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import { Fact } from "../../ui/templates/Record";
import { ContentState, TableSkeleton } from "../../ui/templates/States";

const SOURCE_LABEL: Record<PreferenceSource, string> = {
  member: "Set by member",
  migrated: "Carried over by migration",
  new_account: "Off for new accounts",
};

const onOff = (enabled: boolean) => (enabled ? "On" : "Off");

/** The member's notification defaults and overrides, read-only. */
export function MemberNotificationSettingsPanel({
  userId,
}: {
  userId: number;
}) {
  const query = useNotificationSettingsAdmin(userId);
  const settings = query.data;
  return (
    <Panel
      title="Notification settings"
      description={
        settings
          ? `${formatCount(settings.overrides.length)} overrides`
          : undefined
      }
      flush
    >
      <ContentState
        things="notification settings"
        query={query}
        skeleton={<TableSkeleton columns={4} rows={4} />}
      >
        {settings && (
          <>
            <div className="border-b border-line px-card py-3">
              <h3 className="sr-only">Defaults</h3>
              <dl className="grid grid-cols-2 gap-x-6 @4xl:grid-cols-4">
                {CHANNELS.map((channel) => (
                  <Fact
                    key={channel}
                    label={`${CHANNEL_LABEL[channel]} default`}
                  >
                    {onOff(defaultOf(settings, channel))}
                  </Fact>
                ))}
              </dl>
            </div>
            {settings.overrides.length === 0 ? (
              <p className="px-card py-4 text-fg-muted">
                Every notification follows the defaults.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Override</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Setting</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.overrides.map((override) => (
                    <TableRow key={`${override.kind}:${override.channel}`}>
                      <TableCell truncate className="font-medium">
                        {override.label}
                      </TableCell>
                      <TableCell>{CHANNEL_LABEL[override.channel]}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {onOff(override.enabled)}
                          {!override.inEffect && (
                            <Badge tone={BadgeTone.Neutral}>
                              Not in effect
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>{SOURCE_LABEL[override.source]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </ContentState>
    </Panel>
  );
}
