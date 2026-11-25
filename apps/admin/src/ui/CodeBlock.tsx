import { Fragment } from "react";

/**
 * A command or snippet to read and copy. Lines wrap only between words, never
 * after a hyphen inside a flag; a word wider than the block scrolls.
 */
export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-xs whitespace-pre-wrap">
      <code>
        {children.split(" ").map((word, index) => (
          <Fragment key={index}>
            {index > 0 && " "}
            <span className="whitespace-pre">{word}</span>
          </Fragment>
        ))}
      </code>
    </pre>
  );
}
