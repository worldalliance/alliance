import { type ErrorResponse, isRouteErrorResponse } from "react-router";
import { Route } from "../.react-router/types/src/+types/root";
import { NotFoundPage, NotFoundSource } from "./site/NotFoundPage";

export const isNotFound = (error: unknown): error is ErrorResponse =>
  isRouteErrorResponse(error) && error.status === 404;

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isNotFound(error)) {
    return (
      <NotFoundPage
        source={
          error.data === NotFoundSource.MissingRecord
            ? NotFoundSource.MissingRecord
            : NotFoundSource.UnmatchedRoute
        }
      />
    );
  }
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
