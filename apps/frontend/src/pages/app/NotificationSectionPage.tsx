import {
  EMPTY_SECTION,
  kindsIn,
  parseSection,
  SECTION_TITLE,
  UNKNOWN_SECTION,
} from "@alliance/shared/lib/notificationSettings";
import { useNotificationSettings } from "@alliance/shared/lib/useNotificationSettings";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import NotificationKindRow from "../../components/settings/NotificationKindRow";
import NotificationSettingsPending from "../../components/settings/NotificationSettingsPending";

export default function NotificationSectionPage() {
  const section = parseSection(useParams().section);
  const {
    settings,
    loadFailed,
    retrying,
    refetch,
    save,
    retry,
    statusOf,
    shownOverride,
    resetOf,
  } = useNotificationSettings();

  const body = () => {
    if (!section) {
      return <p>{UNKNOWN_SECTION}</p>;
    }
    if (!settings) {
      return (
        <NotificationSettingsPending
          loadFailed={loadFailed}
          retrying={retrying}
          onRetry={() => void refetch()}
        />
      );
    }
    const kinds = kindsIn(settings, section);
    if (!kinds.length) {
      return <p>{EMPTY_SECTION}</p>;
    }
    return (
      <ul className="flex flex-col divide-y divide-zinc-200">
        {kinds.map((kind) => (
          <NotificationKindRow
            key={kind.kind}
            kind={kind}
            save={save}
            retry={retry}
            statusOf={statusOf}
            shownOverride={shownOverride}
            resetOf={resetOf}
          />
        ))}
      </ul>
    );
  };

  return (
    <CenterLayout>
      <div className="mb-6 flex flex-col gap-y-6">
        <div className="flex items-center gap-x-2">
          <Link
            to="/settings#notifications"
            aria-label="Back to settings"
            className="rounded p-1 hover:bg-black/5"
          >
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-title">
            {section ? SECTION_TITLE[section] : "Notifications"}
          </h1>
        </div>
        <Card style={CardStyle.White} className="p-6">
          {body()}
        </Card>
      </div>
    </CenterLayout>
  );
}
