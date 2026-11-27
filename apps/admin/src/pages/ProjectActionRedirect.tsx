import { Navigate, useLocation, useParams } from "react-router";
import { projectActionRedirect } from "./action-dashboard/workspaceLocation";

const ProjectActionRedirect = () => {
  const { actionId } = useParams<{ actionId: string }>();
  const { search, hash } = useLocation();
  return (
    <Navigate
      replace
      to={projectActionRedirect({ actionId: actionId!, search, hash })}
    />
  );
};

export default ProjectActionRedirect;
