import { isRouteErrorResponse } from "react-router";
import { Route } from "../.react-router/types/src/+types/root";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (import.meta.env.PROD) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        {error instanceof Error && (
          <p className="text-red-500">{error.message}</p>
        )}
        {isRouteErrorResponse(error) ? (
          <p>
            {error.status} {error.statusText}
          </p>
        ) : (
          <p>Please try again</p>
        )}
      </div>
    );
  }
  if (isRouteErrorResponse(error)) {
    return (
      <>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </>
    );
  } else if (error instanceof Error) {
    return (
      <div className="p-2">
        <h3>Error</h3>
        <p>{error.message}</p>
        <pre className="text-red-500">{error.stack}</pre>
      </div>
    );
  } else {
    return <h1>Unknown Error</h1>;
  }
}
