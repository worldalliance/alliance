import { useGrayBackground } from "../../components/HtmlBackgroundManager";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import { actionsGetTimelineFeed } from "@alliance/shared/client";
import { useQuery } from "@tanstack/react-query";
import ActionsTimelineEvent from "./ActionsTimelineEvent";
import List from "@alliance/sharedweb/ui/List";
import ActionUpdateItem from "@alliance/sharedweb/ui/ActionUpdateItem";
import Card from "@alliance/sharedweb/ui/Card";

const ActionsListPage = () => {
  const { data: timelineFeed } = useQuery({
    queryKey: ["timelineFeed"],
    queryFn: () =>
      actionsGetTimelineFeed({ query: { limit: 15 } }).then(
        (response) => response.data ?? []
      ),
  });

  useGrayBackground();

  if (!timelineFeed) {
    return <div>Loading...</div>;
  }

  return (
    <CenterLayout className="gap-y-4" width="4xl">
      <p className="font-serif text-lg font-bold">Happening Now</p>
      <div className="flex flex-row gap-x-4 overflow-x-auto">
        <Card className="max-w-[300px] flex-shrink-0">
          <p className="font-semibold">
            Combining member opinions into docket comments
          </p>
          <p>
            We are writing comments for all three dockets that summarize member
            opinions on the proposed rules.
          </p>
        </Card>
        <Card className="max-w-[300px] flex-shrink-0">
          <p className="font-semibold">
            Combining member opinions into docket comments
          </p>
          <p>
            We are writing comments for all three dockets that summarize member
            opinions on the proposed rules.
          </p>
        </Card>
        <Card className="max-w-[300px] flex-shrink-0">
          <p className="font-semibold">
            Combining member opinions into docket comments
          </p>
          <p>
            We are writing comments for all three dockets that summarize member
            opinions on the proposed rules.
          </p>
        </Card>
      </div>
      <p className="font-serif text-lg font-bold">Previously</p>
      <List className="*:p-6 divide-y divide-zinc-200">
        {timelineFeed.map((item) =>
          item.type === "action_update" ? (
            <ActionUpdateItem
              key={item.actionUpdate?.id}
              update={item.actionUpdate!}
            />
          ) : item.actionEvent ? (
            <ActionsTimelineEvent
              key={item.actionEvent.id}
              action={item.action}
              event={item.actionEvent}
            />
          ) : null
        )}
      </List>
    </CenterLayout>
  );
};

export default ActionsListPage;
