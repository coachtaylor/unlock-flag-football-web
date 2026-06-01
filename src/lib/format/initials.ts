// Initials from a full-name string — first + last initial, uppercased.
// Shared by the roster players table and the coaching-staff table so avatar
// initials read identically. (Sidebars derive initials from separate
// firstName/lastName fields and keep their own inline form.)
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}
