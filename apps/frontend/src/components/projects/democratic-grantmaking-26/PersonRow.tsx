import type { ProjectPerson } from "./placeholders";

export function PersonRow({ person }: { person: ProjectPerson }) {
  return (
    <div className="site-sans flex items-center gap-2.5 text-sm leading-snug">
      <img
        src={person.imageSrc}
        alt=""
        className="size-12 shrink-0 rounded-[2px] object-cover"
        width={48}
        height={48}
      />
      <div className="flex flex-col">
        <a
          href={person.href}
          target="_blank"
          rel="noreferrer"
          className="text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
        >
          {person.name}
        </a>
        <span className="text-white/80">{person.role}</span>
      </div>
    </div>
  );
}
