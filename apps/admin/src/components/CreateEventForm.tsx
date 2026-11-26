import type {
  ActionSuiteDto,
  CreateActionEventDto,
} from "@alliance/shared/client";
import { milliseconds } from "date-fns";
import { AddEventForm } from "../pages/tasks/events/AddEventForm";
import { EventTargetKind } from "../pages/tasks/events/eventRules";

export {
  LAUNCH_CONFIRM_TEXT,
  type AddActionEvent,
} from "../pages/tasks/events/eventRules";

export type CreateEventFormProps = {
  creatingEvent: boolean;
  setCreatingEvent: (creatingEvent: boolean) => void;
  setEventCreatedSuccess: (eventCreatedSuccess: boolean) => void;
  eventCreatedSuccess: boolean;
  suiteMode: true;
  /** Resolves `null` when staff decline to move the deadline earlier. */
  addToSuite: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
};

/**
 * Today's import path and props for the suite record's add-event form. A
 * task's own events are added on its Events tab (`pages/tasks/events/`).
 */
const CreateEventForm = ({
  setCreatingEvent,
  setEventCreatedSuccess,
  addToSuite,
}: CreateEventFormProps) => (
  <AddEventForm
    target={{ kind: EventTargetKind.Suite }}
    send={async (body) => (await addToSuite(body)) !== null}
    onPendingChange={setCreatingEvent}
    onAdded={() => {
      setEventCreatedSuccess(true);
      setTimeout(
        () => setEventCreatedSuccess(false),
        milliseconds({ seconds: 3 }),
      );
    }}
  />
);

export default CreateEventForm;
