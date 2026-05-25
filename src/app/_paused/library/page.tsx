// PAUSED: Individual QB tracking is on hold while the Coach/Team MVP is the focus.
// This route is no longer linked from the bottom nav. Do not extend; preserved for resumption.
// Reference library hub — browse routes, defensive coverages, and play concepts.
// Full spec: DESIGN_HANDOFF.md → Screen 5: Reference Library

import Link from "next/link";

const libraries = [
  { title: "Routes", count: 10, href: "/library/routes", color: "var(--color-orange-400)" },
  { title: "Defensive Coverages", count: 6, href: "/library/coverages", color: "var(--color-indigo-400)" },
  { title: "Play Concepts", count: 6, href: "/library/concepts", color: "var(--color-indigo-400)" },
];

export default function Library() {
  return (
    <div className="pt-3xl">
      <h1 className="text-title font-medium" style={{ color: "var(--color-text-primary)" }}>
        Library
      </h1>
      <p className="text-caption mt-xs" style={{ color: "var(--color-text-secondary)" }}>
        Study routes, coverages, and play concepts.
      </p>

      <div className="flex flex-col gap-md mt-2xl">
        {libraries.map((lib) => (
          <Link
            key={lib.href}
            href={lib.href}
            className="p-lg rounded-lg no-underline flex items-center justify-between"
            style={{ backgroundColor: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
          >
            <div>
              <p className="text-heading font-medium" style={{ color: "var(--color-text-primary)" }}>{lib.title}</p>
              <p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>{lib.count} entries</p>
            </div>
            <span style={{ color: lib.color, fontSize: "20px" }}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
