import Actions from "../pages/Actions";
import NewTimelinePage from "../pages/NewTimelinePage";
import PriorityPage from "../pages/PriorityPage";
import { PlaceId } from "../places";
import TabbedPlace from "../shell/TabbedPlace";

export default function TasksPlace() {
  return (
    <TabbedPlace
      place={PlaceId.AllTasks}
      views={{
        timeline: NewTimelinePage,
        list: Actions,
        priority: PriorityPage,
      }}
    />
  );
}
