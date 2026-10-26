import { type ComponentType, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ChunkLoadError, lazyOrReload } from "../lib/lazyOrReload";
import { ValidationMessage } from "./fieldParts";

/**
 * A form part loaded on demand, showing nothing until its chunk arrives, and
 * in place of the part alone a chunk that never does.
 */
export function lazyFormPart<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
) {
  const Part = lazyOrReload(load);
  return function LazyFormPart(props: Props) {
    return (
      <ErrorBoundary
        fallbackRender={({ error }) => {
          if (!(error instanceof ChunkLoadError)) throw error;
          return <ValidationMessage message={error.message} />;
        }}
      >
        <Suspense fallback={null}>
          <Part {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}
