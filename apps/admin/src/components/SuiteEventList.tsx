import {
  ActionSuiteDto,
  CreateActionEventDto,
  UpdateActionEventDto,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useState } from "react";
import CreateEventForm from "./CreateEventForm";
import SuiteEventCard from "./SuiteEventCard";

export type SuiteEventListProps = {
  events: ActionSuiteDto["events"];
  onEdit: (eventId: number, body: UpdateActionEventDto) => void;
  onDelete: (eventId: number) => void;
  className?: string;
  addToSuite: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
};

const SuiteEventList = ({
  events,
  onEdit,
  onDelete,
  className,
  addToSuite,
}: SuiteEventListProps) => {
  const [creatingEvent, setCreatingEvent] = useState<boolean>(false);
  const [eventFormOpen, setEventFormOpen] = useState<boolean>(false);

  return (
    <div>
      <div className={cn("flex flex-row gap-4 items-center", className)}>
        {(events ?? [])
          .slice()
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
            creatingEvent={creatingEvent}
            setCreatingEvent={setCreatingEvent}
            setEventCreatedSuccess={() => {}}
            eventCreatedSuccess={false}
            suiteMode={true}
            addToSuite={addToSuite}
          />
        </Card>
      )}
    </div>
  );
};

export default SuiteEventList;
