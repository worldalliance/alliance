import {
  ActionDto,
  ActionSuiteDto,
  UpdateActionEventDto,
} from "@alliance/shared/client";
import clsx from "clsx";
import SuiteEventCard from "./SuiteEventCard";
import { useState } from "react";
import CreateEventForm from "./CreateEventForm";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card from "@alliance/shared/ui/Card";

export type SuiteEventListProps = {
  referenceAction: ActionDto;
  events: ActionSuiteDto["events"];
  onEdit: (eventId: number, body: UpdateActionEventDto) => void;
  onDelete: (eventId: number) => void;
  className?: string;
  suiteId: number;
  setSuite: (suite: ActionSuiteDto) => void;
};

const SuiteEventList = ({
  referenceAction,
  events,
  onEdit,
  onDelete,
  className,
  suiteId,
  setSuite,
}: SuiteEventListProps) => {
  const [creatingEvent, setCreatingEvent] = useState<boolean>(false);
  const [eventFormOpen, setEventFormOpen] = useState<boolean>(false);

  return (
    <div>
      <div className={clsx("flex flex-row gap-4 items-center", className)}>
        {events
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((event) => (
            <SuiteEventCard
              key={event.id}
              event={event}
              onEdit={(body) => onEdit(event.id, body)}
              onDelete={() => onDelete(event.id)}
            />
          ))}
        <Button
          color={ButtonColor.Grey}
          onClick={() => setEventFormOpen((prev) => !prev)}
        >
          +
        </Button>
      </div>
      {eventFormOpen && (
        <Card className="my-4">
          <CreateEventForm
            action={referenceAction}
            creatingEvent={creatingEvent}
            setCreatingEvent={setCreatingEvent}
            setEventCreatedSuccess={() => {}}
            eventCreatedSuccess={false}
            suiteMode={true}
            suiteId={suiteId}
            setSuite={setSuite}
          />
        </Card>
      )}
    </div>
  );
};

export default SuiteEventList;
