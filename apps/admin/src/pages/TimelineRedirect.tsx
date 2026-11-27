import { Navigate } from "react-router";
import { ActionsView } from "./Actions";

const TimelineRedirect = () => (
  <Navigate to={`/actions?view=${ActionsView.Timeline}`} replace />
);

export default TimelineRedirect;
