import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import SectionEyebrow from "@/components/marketing/SectionEyebrow";
import MiniDashboard from "@/components/marketing/MiniDashboard";
import DiagramPreview from "@/components/marketing/DiagramPreview";
import FAQ from "@/components/marketing/FAQ";

const SECTION_WRAP: React.CSSProperties = {
  maxWidth: 1440,
  margin: "0 auto",
};

const HERO_META: [string, string][] = [
  ["Drills", "Diagrammed"],
  ["Roster", "Benchmarked"],
  ["Practice", "Planned"],
];

const ROSTER_FRAGMENT: [string, string, string, string][] = [
  ["J. Mendez", "QB", "+12%", "var(--uff-lime-400)"],
  ["A. Kim", "WR", "+8%", "var(--uff-lime-400)"],
  ["R. Soto", "DB", "−3%", "var(--uff-red)"],
];

const WHO_CARDS = [
  {
    tag: "Planning",
    title: "The captain at the desk",
    body:
      "Building drill libraries from YouTube, planning the week's practice in three panes, reviewing what the team is actually weak at.",
  },
  {
    tag: "On field",
    title: "The captain on the field",
    body:
      "Quick benchmark logging between reps, one-handed roster swaps when somebody no-shows, the practice plan in your back pocket.",
  },
  {
    tag: "Goal",
    title: "The team chasing the trophy",
    body:
      "Three teammates trying to peak by week 8. The dashboard shows you whether you're actually getting there or just feeling like it.",
  },
];

const STEPS = [
  {
    n: "01",
    t: "Build your library",
    b: "Diagram three or four drills you actually run. The setup notes write themselves. Categories: offense, defense, footwork, routes, agility, conditioning.",
  },
  {
    n: "02",
    t: "Benchmark the roster",
    b: "Pick a drill, pick a player, log the rep. The dashboard updates as you go. Mobile or web, it doesn't matter — same data.",
  },
  {
    n: "03",
    t: "Plan smarter practices",
    b: "The dashboard tells you what the team is weak at. The practice planner has the drills that fix it. Drag, save, send.",
  },
];

const KEYBOARD_HINTS: [string, string][] = [
  ["⌘ Z", "Undo / redo"],
  ["Click", "Place cone"],
  ["Drag", "Move cone"],
  ["Right-click", "Context menu"],
];

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 500,
          color: "var(--text-primary)",
          marginTop: 4,
        }}
      >
        {v}
      </div>
    </div>
  );
}

function FeatureCard({
  tag,
  title,
  body,
  badge,
  color = "orange",
}: {
  tag: string;
  title: string;
  body: string;
  badge: string;
  color?: "orange" | "lime";
}) {
  return (
    <div
      className="card-canonical"
      style={{
        padding: 32,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 240,
      }}
    >
      <div>
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          <span className="tick" />
          {tag}
        </div>
        <h3
          style={{
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: -0.3,
            lineHeight: 1.2,
            marginBottom: 12,
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {body}
        </p>
      </div>
      <div
        style={{
          marginTop: 28,
          paddingTop: 20,
          borderTop: "1px solid var(--border-subtle-uff)",
        }}
      >
        <span className={`pill pill-${color === "lime" ? "lime" : "orange"} mono`}>
          {badge}
        </span>
      </div>
    </div>
  );
}

export default async function MarketingHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const loggedIn = Boolean(user);
  const primaryCta = loggedIn ? "/dashboard" : "/signup";
  const primaryLabel = loggedIn ? "Go to dashboard →" : "Start free · no card";

  return (
    <div
      style={{
        background: "var(--surface-base)",
        color: "var(--text-primary)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* hero glow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -200,
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 600,
          background:
            "radial-gradient(ellipse, var(--accent-glow), transparent 60%)",
          pointerEvents: "none",
          opacity: 0.6,
          filter: "blur(40px)",
        }}
      />

      <MarketingNav loggedIn={loggedIn} />

      {/* ─────── HERO ─────── */}
      <section
        style={{
          padding: "50px 48px 96px",
          position: "relative",
          ...SECTION_WRAP,
        }}
        className="uff-hero"
      >
        <div
          className="uff-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.1fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          {/* Left — copy */}
          <div>
            <div className="pill pill-orange" style={{ marginBottom: 24 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "var(--accent)",
                }}
              />
              Coach MVP · early access
            </div>
            <h1
              style={{
                fontSize: 84,
                lineHeight: 0.98,
                fontWeight: 600,
                letterSpacing: -2.5,
                marginBottom: 24,
                maxWidth: "12ch",
              }}
              className="uff-hero-headline"
            >
              Train smarter.
              <br />
              <span style={{ color: "var(--accent)" }}>Win more.</span>
            </h1>
            <p
              style={{
                fontSize: 19,
                lineHeight: 1.55,
                color: "var(--text-secondary)",
                maxWidth: "44ch",
                marginBottom: 36,
              }}
            >
              The drill library, practice planner, and team dashboard built
              captain-to-captain. Plan the week at your desk. Run the practice on the
              field. Same data, both surfaces.
            </p>
            <div style={{ display: "flex", gap: 12, marginBottom: 40, flexWrap: "wrap" }}>
              <Link href={primaryCta} className="btn btn-primary btn-lg">
                {primaryLabel}
              </Link>
              <a href="#features" className="btn btn-secondary btn-lg">
                See it run →
              </a>
            </div>
            <div
              style={{
                display: "flex",
                gap: 32,
                paddingTop: 24,
                borderTop: "1px solid var(--border-default-uff)",
                flexWrap: "wrap",
              }}
            >
              {HERO_META.map(([k, v]) => (
                <div key={k}>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    {k}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--text-primary)",
                      marginTop: 4,
                    }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — device frame + floating fragments */}
          <div
            className="uff-hero-device"
            style={{ position: "relative", height: 560 }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                padding: 12,
                background: "linear-gradient(180deg, #1F1F25, #0E0E11)",
                borderRadius: 16,
                border: "1px solid var(--border-strong-uff)",
                boxShadow:
                  "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,106,26,0.05)",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid var(--border-card)",
                }}
              >
                <MiniDashboard />
              </div>
            </div>

            {/* floating: diagram fragment */}
            <div
              style={{
                position: "absolute",
                left: -64,
                bottom: 40,
                width: 280,
                background: "var(--surface-raised)",
                border: "1px solid var(--border-strong-uff)",
                borderRadius: 16,
                padding: 14,
                boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
                transform: "rotate(-3deg)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 9,
                    color: "var(--text-muted)",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Drill · #047
                </div>
                <span
                  className="pill pill-orange"
                  style={{ fontSize: 9, padding: "2px 6px" }}
                >
                  OFFENSE
                </span>
              </div>
              <div
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid var(--border-card)",
                }}
              >
                <DiagramPreview width={260} height={140} />
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                Slant + Wheel · 4 cones
              </div>
            </div>

            {/* floating: roster fragment */}
            <div
              style={{
                position: "absolute",
                right: -40,
                top: -24,
                width: 240,
                background: "var(--surface-raised)",
                border: "1px solid var(--border-strong-uff)",
                borderRadius: 16,
                padding: 14,
                boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
                transform: "rotate(2deg)",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  color: "var(--text-muted)",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Bench · last assessment
              </div>
              {ROSTER_FRAGMENT.map(([who, pos, delta, color]) => (
                <div
                  key={who}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 0",
                    borderBottom: "1px solid var(--border-subtle-uff)",
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      background: "var(--surface-elevated)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                  >
                    {who[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 500 }}>{who}</div>
                    <div
                      className="mono"
                      style={{ fontSize: 9, color: "var(--text-muted)" }}
                    >
                      {pos}
                    </div>
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 11, color, fontWeight: 500 }}
                  >
                    {delta}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────── WHO IT'S FOR ─────── */}
      <section
        style={{
          padding: "96px 48px",
          borderTop: "1px solid var(--border-default-uff)",
          ...SECTION_WRAP,
        }}
      >
        <SectionEyebrow index="01" label="Who it's for" />
        <h2
          style={{
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: -1,
            lineHeight: 1.1,
            maxWidth: "20ch",
            marginBottom: 56,
          }}
        >
          Built for the captain doing the work nobody else is.
        </h2>
        <div
          className="uff-grid-3"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
          }}
        >
          {WHO_CARDS.map((c, i) => (
            <div key={c.title} className="card-canonical" style={{ padding: 28 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 32,
                }}
              >
                <span className="pill pill-orange">{c.tag}</span>
                <span
                  className="mono"
                  style={{ fontSize: 10, color: "var(--text-muted)" }}
                >
                  0{i + 1}
                </span>
              </div>
              <h3
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: -0.3,
                  marginBottom: 12,
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--text-secondary)",
                }}
              >
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────── FEATURES ─────── */}
      <section
        id="features"
        style={{
          padding: "96px 48px",
          borderTop: "1px solid var(--border-default-uff)",
          ...SECTION_WRAP,
        }}
      >
        <SectionEyebrow index="02" label="Features" />
        <h2
          style={{
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: -1,
            lineHeight: 1.1,
            maxWidth: "22ch",
            marginBottom: 56,
          }}
        >
          Everything the mobile app has — laid out for a real keyboard and a real
          monitor.
        </h2>
        <div
          className="uff-features-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {/* Drill library — big card */}
          <div
            className="card uff-feature-big"
            style={{
              gridColumn: "1 / span 2",
              padding: 0,
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              minHeight: 360,
            }}
          >
            <div
              style={{
                padding: 40,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div className="eyebrow" style={{ marginBottom: 18 }}>
                  <span className="tick" />
                  Drill library
                </div>
                <h3
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    letterSpacing: -0.5,
                    lineHeight: 1.15,
                    marginBottom: 16,
                  }}
                >
                  Diagrams that draw themselves into setup instructions.
                </h3>
                <p
                  style={{
                    fontSize: 15,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    maxWidth: "40ch",
                  }}
                >
                  Drag cones onto a field. Tap to connect routes. The setup steps
                  auto-generate so any assistant can run the drill from the
                  print-out.
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  marginTop: 32,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
              >
                <Stat k="Cone types" v="6" />
                <Stat k="Categories" v="9" />
                <Stat k="Avg build" v="3 min" />
              </div>
            </div>
            <div
              style={{
                background: "linear-gradient(135deg, #0E1815, #08090B)",
                padding: 24,
                display: "grid",
                placeItems: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  border: "1px solid var(--border-card)",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "var(--surface-base)",
                }}
              >
                <DiagramPreview width={420} height={240} />
              </div>
            </div>
          </div>

          <FeatureCard
            tag="Roster"
            title="Benchmark every player, every drill."
            body="A row per player, a column per drill. The dashboard rolls up the gaps before the next practice."
            badge="14 players · 47 benchmarks"
          />
          <FeatureCard
            tag="Practice"
            title="Three panes. Drag. Done."
            body="Drill library on the left, the timeline in the middle, notes on the right. Plan a 90-minute practice in under five."
            badge="≈ 12 drills / hr"
            color="lime"
          />

          {/* Dashboard — big card */}
          <div
            className="card uff-feature-big"
            style={{
              gridColumn: "1 / span 2",
              padding: 40,
              display: "grid",
              gridTemplateColumns: "1fr 1.2fr",
              gap: 40,
              alignItems: "center",
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 18 }}>
                <span className="tick" />
                Dashboard
              </div>
              <h3
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  letterSpacing: -0.5,
                  lineHeight: 1.15,
                  marginBottom: 16,
                }}
              >
                The honest version of &ldquo;how&rsquo;s the team doing?&rdquo;
              </h3>
              <p
                style={{
                  fontSize: 15,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  maxWidth: "44ch",
                }}
              >
                Strength + weakness ranked by recent benchmarks. Practice history
                with attendance. Per-player trends as soon as you have data to trend.
              </p>
            </div>
            <div
              style={{
                border: "1px solid var(--border-card)",
                borderRadius: 12,
                overflow: "hidden",
                aspectRatio: "16/10",
              }}
            >
              <MiniDashboard />
            </div>
          </div>
        </div>
      </section>

      {/* ─────── HOW IT WORKS ─────── */}
      <section
        id="how"
        style={{
          padding: "96px 48px",
          borderTop: "1px solid var(--border-default-uff)",
          ...SECTION_WRAP,
        }}
      >
        <SectionEyebrow index="03" label="How it works" />
        <h2
          style={{
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: -1,
            lineHeight: 1.1,
            marginBottom: 56,
          }}
        >
          Three steps. About thirty minutes.
        </h2>
        <div
          className="uff-grid-3"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            position: "relative",
          }}
        >
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ position: "relative" }}>
              <div className="card-canonical" style={{ padding: 32 }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--accent)",
                    letterSpacing: 1.5,
                    marginBottom: 32,
                  }}
                >
                  STEP {s.n}
                </div>
                <h3
                  style={{
                    fontSize: 22,
                    fontWeight: 500,
                    letterSpacing: -0.3,
                    marginBottom: 14,
                  }}
                >
                  {s.t}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  {s.b}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="uff-step-arrow"
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: -12,
                    fontSize: 24,
                    color: "var(--text-muted)",
                    transform: "translateY(-50%)",
                  }}
                >
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─────── DIAGRAM BUILDER SHOWCASE ─────── */}
      <section
        style={{
          padding: "96px 48px",
          borderTop: "1px solid var(--border-default-uff)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          className="field-stripes"
          style={{ position: "absolute", inset: 0, opacity: 0.5 }}
        />
        <div style={{ ...SECTION_WRAP, position: "relative" }}>
          <div
            className="uff-spotlight-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.4fr",
              gap: 64,
              alignItems: "center",
            }}
          >
            <div>
              <SectionEyebrow index="04" label="Spotlight · Diagram builder" />
              <h2
                style={{
                  fontSize: 44,
                  fontWeight: 600,
                  letterSpacing: -1,
                  lineHeight: 1.05,
                  marginBottom: 24,
                }}
              >
                The reason most captains
                <br />
                <span style={{ color: "var(--accent)" }}>open the laptop.</span>
              </h2>
              <p
                style={{
                  fontSize: 17,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  marginBottom: 32,
                  maxWidth: "44ch",
                }}
              >
                Touch-first on the field. Mouse-native at the desk. Right-click for
                the context menu. Cmd-Z to undo the last cone. The diagram you draw
                becomes the setup card your team reads.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  maxWidth: 420,
                }}
              >
                {KEYBOARD_HINTS.map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border-card)",
                      borderRadius: 10,
                    }}
                  >
                    <kbd
                      className="mono"
                      style={{
                        padding: "3px 8px",
                        background: "var(--surface-elevated)",
                        border: "1px solid var(--border-strong-uff)",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                    >
                      {k}
                    </kbd>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-strong-uff)",
                borderRadius: 18,
                padding: 16,
                boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 8px 14px",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Drill #047 · Slant + Wheel
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["○", "□", "△", "↳"].map((g, i) => (
                    <div
                      key={i}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background:
                          i === 0
                            ? "var(--accent-tint)"
                            : "var(--surface-base)",
                        border:
                          "1px solid " +
                          (i === 0
                            ? "var(--accent-tint-border)"
                            : "var(--border-card)"),
                        display: "grid",
                        placeItems: "center",
                        fontSize: 13,
                        color:
                          i === 0 ? "var(--accent)" : "var(--text-secondary)",
                      }}
                    >
                      {g}
                    </div>
                  ))}
                </div>
              </div>
              <div
                style={{
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "1px solid var(--border-card)",
                }}
              >
                <DiagramPreview width={640} height={360} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────── FAQ ─────── */}
      <section
        id="faq"
        style={{
          padding: "96px 48px",
          borderTop: "1px solid var(--border-default-uff)",
          ...SECTION_WRAP,
        }}
      >
        <SectionEyebrow index="05" label="FAQ" />
        <h2
          style={{
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: -1,
            lineHeight: 1.1,
            marginBottom: 56,
          }}
        >
          The questions other captains ask.
        </h2>
        <FAQ />
      </section>

      {/* ─────── FINAL CTA ─────── */}
      <section
        style={{
          padding: "96px 48px",
          borderTop: "1px solid var(--border-default-uff)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 60% 80% at 50% 100%, var(--accent-glow), transparent 60%)",
            opacity: 0.7,
          }}
        />
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            textAlign: "center",
            position: "relative",
          }}
        >
          <SectionEyebrow index="06" label="Get going" />
          <h2
            style={{
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: -1.5,
              lineHeight: 1.0,
              margin: "8px 0 24px",
            }}
            className="uff-final-headline"
          >
            One captain. One season.
            <br />
            <span style={{ color: "var(--accent)" }}>One trophy.</span>
          </h2>
          <p
            style={{
              fontSize: 17,
              color: "var(--text-secondary)",
              lineHeight: 1.55,
              maxWidth: "44ch",
              margin: "0 auto 36px",
            }}
          >
            Free while we&rsquo;re in early access. Bring your roster, your drills,
            and whatever league you&rsquo;re trying to win.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {loggedIn ? (
              <Link href="/dashboard" className="btn btn-primary btn-lg">
                Open your dashboard
              </Link>
            ) : (
              <>
                <Link href="/signup" className="btn btn-primary btn-lg">
                  Create your team
                </Link>
                <Link href="/login" className="btn btn-ghost btn-lg">
                  Log in instead
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
