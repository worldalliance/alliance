import { EmptyState } from "../../ui/EmptyState";

/** The Inbox's canvas at `/inbox`, before a thread is open. */
export default function NoThreadOpen() {
  return (
    <EmptyState
      title="No thread open"
      description="Choose a phone number from the list to read its texts and reply."
      className="my-auto"
    />
  );
}
