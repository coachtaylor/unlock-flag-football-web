const NAV_ITEMS: [string, boolean][] = [
  ["Dashboard", true],
  ["Drills", false],
  ["Roster", false],
  ["Practice", false],
];

const STATS = [
  { k: "Roster", v: "14", d: "+2 wk", color: "var(--uff-lime-400)" },
  { k: "Benchmarks", v: "47", d: "+9 wk", color: "var(--uff-lime-400)" },
  { k: "Avg drill rating", v: "3.8", d: "+0.4", color: "var(--uff-lime-400)" },
];

const STRENGTH_ROWS = [
  { name: "Routes", val: 82, color: "var(--uff-lime-400)" },
  { name: "QB accuracy", val: 71, color: "var(--uff-lime-400)" },
  { name: "Flag pulling", val: 54, color: "var(--accent)" },
  { name: "Footwork", val: 38, color: "var(--uff-red)" },
];

const RECENT_BENCHMARKS: [string, string, string][] = [
  ["J. Mendez", "Slants", "4.2"],
  ["A. Kim", "10y dash", "1.81s"],
  ["T. Pang", "Spirals", "3.5"],
  ["R. Soto", "5y dash", "1.04s"],
];

export default function MiniDashboard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--surface-base)",
        padding: 20,
        display: "flex",
        gap: 16,
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 160,
          background: "var(--surface-raised)",
          border: "1px solid var(--border-card)",
          borderRadius: 14,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--accent)",
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 500 }}>The Outlaws</span>
        </div>
        {NAV_ITEMS.map(([label, active]) => (
          <div
            key={label}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              fontSize: 11,
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              background: active ? "var(--surface-muted)" : "transparent",
              borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Main */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              className="mono"
              style={{
                fontSize: 9,
                color: "var(--text-muted)",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Week 4 · Tuesday
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>Dashboard</div>
          </div>
          <div
            style={{
              fontSize: 10,
              padding: "5px 9px",
              borderRadius: 6,
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 500,
            }}
          >
            + New practice
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {STATS.map((s) => (
            <div
              key={s.k}
              className="card-canonical"
              style={{ padding: 12, borderRadius: 10 }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 8,
                  color: "var(--text-muted)",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {s.k}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginTop: 4,
                  color: "var(--text-primary)",
                }}
              >
                {s.v}
                <span
                  style={{
                    fontSize: 9,
                    color: s.color,
                    marginLeft: 4,
                    fontWeight: 500,
                  }}
                >
                  {s.d}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 10,
            flex: 1,
            minHeight: 0,
          }}
        >
          <div className="card" style={{ padding: 12, borderRadius: 10 }}>
            <div
              className="mono"
              style={{
                fontSize: 8,
                color: "var(--text-muted)",
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Team strength · weakness
            </div>
            {STRENGTH_ROWS.map((r) => (
              <div
                key={r.name}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
              >
                <div style={{ fontSize: 10, width: 70, color: "var(--text-secondary)" }}>
                  {r.name}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 4,
                    background: "var(--surface-muted)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${r.val}%`,
                      height: "100%",
                      background: r.color,
                    }}
                  />
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    width: 24,
                    textAlign: "right",
                    color: "var(--text-primary)",
                  }}
                >
                  {r.val}
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 12, borderRadius: 10 }}>
            <div
              className="mono"
              style={{
                fontSize: 8,
                color: "var(--text-muted)",
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Recent benchmarks
            </div>
            {RECENT_BENCHMARKS.map(([who, what, val]) => (
              <div
                key={who}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0",
                  borderBottom: "1px solid var(--border-subtle-uff)",
                  fontSize: 10,
                }}
              >
                <div>
                  <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {who}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 9 }}>{what}</div>
                </div>
                <div className="mono" style={{ color: "var(--uff-lime-400)" }}>
                  {val}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
