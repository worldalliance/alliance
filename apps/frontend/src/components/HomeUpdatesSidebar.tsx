import HomeUpdateCard from "./HomeUpdateCard";
import HomeUpdatesSection from "./HomeUpdatesSection";

const SIDEBAR_UPDATES = 3;

export default function HomeUpdatesSidebar() {
  return (
    <HomeUpdatesSection className="min-h-0 flex-1">
      {({ updates, isNew, markOpened }) => (
        <ul className="flex min-h-0 flex-col gap-3 overflow-y-auto pb-4">
          {updates.slice(0, SIDEBAR_UPDATES).map((update) => (
            <li key={update.id}>
              <HomeUpdateCard
                update={update}
                isNew={isNew(update.id)}
                onOpen={markOpened}
              />
            </li>
          ))}
        </ul>
      )}
    </HomeUpdatesSection>
  );
}
