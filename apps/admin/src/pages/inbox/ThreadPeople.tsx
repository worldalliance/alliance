import { formatPhoneNumberForDisplay } from "@alliance/common/phone";
import type { NumberThreadDto } from "@alliance/shared/client/types.gen";
import { cn } from "../../ui/cn";
import { PersonChip } from "../../ui/PersonCell";
import { Skeleton } from "../../ui/Skeleton";
import { Fact, FactList } from "../../ui/templates/Record";
import { PaneHeader } from "../../ui/templates/Workspace";

/**
 * The Inbox's inspector: the open thread's number and the members who have
 * it. With no thread open it says what to open, so the pane keeps its place.
 */
export function ThreadPeople({
  thread,
}: {
  thread: { data: NumberThreadDto | undefined; isPending: boolean } | null;
}) {
  return (
    <>
      <PaneHeader title="On this number" />
      <div className="px-card py-3">
        {thread === null ? (
          <p className="text-fg-muted">
            Open a thread to see its number and the members who have it.
          </p>
        ) : thread.data ? (
          <FactList>
            <Fact label="Phone number">
              {formatPhoneNumberForDisplay(thread.data.phoneNumber)}
            </Fact>
            <Fact label={thread.data.members.length > 1 ? "Members" : "Member"}>
              {thread.data.members.length === 0 ? (
                "No member has this phone number."
              ) : (
                <ul className="flex min-w-0 flex-col gap-1.5">
                  {thread.data.members.map((member) => (
                    <li key={member.id} className="flex min-w-0">
                      <PersonChip
                        userId={member.id}
                        name={member.name}
                        profilePicture={null}
                        link
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Fact>
          </FactList>
        ) : (
          thread.isPending && (
            <div aria-hidden="true" className="flex flex-col">
              {["w-32", "w-40"].map((width) => (
                <div key={width} className="flex min-h-9 items-center gap-2">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className={cn("h-3.5", width)} />
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </>
  );
}
