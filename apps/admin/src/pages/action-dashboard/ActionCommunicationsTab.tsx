import type { TagDto } from "@alliance/shared/client";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import ActionUpdatesTab from "../../components/ActionUpdatesTab";
import type { AddActionEvent } from "../../components/CreateEventForm";
import EventManagementTab from "../../components/EventManagementTab";
import { CommunicationsSection } from "./workspaceLocation";

const ActionCommunicationsTab = ({
  action,
  addEvent,
  availableTags,
}: {
  action: ParsedActionDto;
  addEvent: AddActionEvent;
  availableTags: TagDto[];
}) => (
  <div className="flex flex-col gap-y-8">
    <section
      id={CommunicationsSection.Events}
      aria-labelledby={`${CommunicationsSection.Events}-heading`}
      className="flex flex-col gap-y-3"
    >
      <h2
        id={`${CommunicationsSection.Events}-heading`}
        className="text-base font-semibold text-zinc-900"
      >
        Events
      </h2>
      <EventManagementTab action={action} addEvent={addEvent} />
    </section>
    <section
      id={CommunicationsSection.Updates}
      aria-labelledby={`${CommunicationsSection.Updates}-heading`}
      className="flex flex-col gap-y-3"
    >
      <h2
        id={`${CommunicationsSection.Updates}-heading`}
        className="text-base font-semibold text-zinc-900"
      >
        Updates
      </h2>
      <ActionUpdatesTab
        actionId={action.id}
        updates={action.updates ?? []}
        events={action.events ?? []}
        availableTags={availableTags}
      />
    </section>
  </div>
);

export default ActionCommunicationsTab;
