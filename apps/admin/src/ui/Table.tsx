import type React from "react";
import { cn } from "./cn";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full border-collapse text-left", className)}
      {...props}
    />
  );
}

function TableHeader(props: React.ComponentProps<"thead">) {
  return <thead {...props} />;
}

function TableBody(props: React.ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b border-line last:border-b-0", className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-th border-b border-line px-cell text-caption font-medium whitespace-nowrap text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("h-row px-cell", className)} {...props} />;
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
