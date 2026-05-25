// PAUSED: Individual QB tracking is on hold while the Coach/Team MVP is the focus.
// This route is no longer linked from the bottom nav. Do not extend; preserved for resumption.
// Log hub — choose what to log: workout, throwing session, game recap, or recovery.
// This is the landing page for the "Log" tab in bottom nav.

import Link from "next/link";

const logOptions = [
  {
    title: "Workout",
    description: "Log exercises, sets, and optional details",
    href: "/log/workout",
    icon: "💪",
  },
  {
    title: "Throwing Session",
    description: "Track throws, elbow pain, and mechanics",
    href: "/log/throwing",
    icon: "🏈",
  },
  {
    title: "Game Recap",
    description: "Post-game performance and struggle tags",
    href: "/log/game-recap",
    icon: "🏟️",
  },
  {
    title: "Recovery Check-in",
    description: "Sleep, stress, and elbow pain at rest",
    href: "/log/recovery",
    icon: "😴",
  },
];

export default function LogHub() {
  return (
    <div className="pt-3xl">
      <h1
        className="text-title font-medium"
        style={{ color: "var(--color-text-primary)" }}
      >
        Log a Session
      </h1>
      <p
        className="text-caption mt-xs"
        style={{ color: "var(--color-text-secondary)" }}
      >
        What are you tracking today?
      </p>

      <div className="flex flex-col gap-md mt-2xl">
        {logOptions.map((option) => (
          <Link
            key={option.href}
            href={option.href}
            className="p-lg rounded-lg no-underline flex items-center gap-lg transition-colors"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            <span className="text-2xl">{option.icon}</span>
            <div>
              <p
                className="text-heading font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {option.title}
              </p>
              <p
                className="text-caption"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {option.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
