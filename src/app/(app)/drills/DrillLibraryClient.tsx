"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Category = { id: string; name: string };

type Drill = {
  id: string;
  name: string;
  status: "draft" | "published";
  benchmarkType: "timed" | "rated" | null;
  categoryIds: string[];
  categoryNames: string[];
};

type Props = {
  categories: Category[];
  drills: Drill[];
};

const ALL = "__all__";

export default function DrillLibraryClient({ categories, drills }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>(ALL);

  const filtered = useMemo(() => {
    if (activeCategory === ALL) return drills;
    return drills.filter((d) => d.categoryIds.includes(activeCategory));
  }, [drills, activeCategory]);

  const pillStyle = (selected: boolean) => ({
    padding: "8px 14px",
    minHeight: "44px",
    backgroundColor: selected ? "#5C3308" : "rgba(255,255,255,0.04)",
    color: selected ? "#F0B870" : "rgba(255,255,255,0.45)",
    border: selected ? "1px solid #D48A30" : "1px solid rgba(255,255,255,0.08)",
  });

  return (
    <>
      <div
        className="mt-2xl mb-2xl flex gap-sm overflow-x-auto"
        style={{ paddingTop: "4px", paddingBottom: "16px" }}
      >
        <button
          type="button"
          onClick={() => setActiveCategory(ALL)}
          aria-pressed={activeCategory === ALL}
          className="rounded-pill text-caption font-medium transition-all flex-shrink-0"
          style={pillStyle(activeCategory === ALL)}
        >
          All
        </button>
        {categories.map((c) => {
          const selected = activeCategory === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              aria-pressed={selected}
              className="rounded-pill text-caption font-medium transition-all flex-shrink-0 capitalize"
              style={pillStyle(selected)}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div
          className="p-2xl rounded-lg text-center"
          style={{
            backgroundColor: "var(--color-surface-base)",
            border: "1px dashed var(--color-border-default)",
          }}
        >
          <p
            className="text-body"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {drills.length === 0
              ? "No drills yet. Add your first drill to get started."
              : "No drills in this category."}
          </p>
          <Link
            href="/drills/new"
            className="inline-block mt-lg rounded-pill text-caption font-medium no-underline"
            style={{
              padding: "10px 16px",
              backgroundColor: "var(--color-orange-500)",
              color: "#FFFFFF",
              letterSpacing: "0.3px",
            }}
          >
            Add Drill
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {filtered.map((d) => (
            <Link
              key={d.id}
              href={`/drills/${d.id}`}
              className="p-lg rounded-lg no-underline"
              style={{
                backgroundColor: "var(--color-surface-base)",
                border:
                  d.status === "draft"
                    ? "1px dashed var(--color-border-default)"
                    : "1px solid var(--color-border-subtle)",
              }}
            >
              <div className="flex items-start justify-between gap-md">
                <p
                  className="text-heading font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {d.name}
                </p>
                {d.status === "draft" && (
                  <span
                    className="text-micro font-medium rounded-pill flex-shrink-0"
                    style={{
                      padding: "2px 8px",
                      backgroundColor: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.45)",
                      border: "1px dashed rgba(255,255,255,0.18)",
                    }}
                  >
                    Draft
                  </span>
                )}
              </div>
              <div className="flex items-center gap-xs mt-sm flex-wrap">
                {d.categoryNames.map((name) => (
                  <span
                    key={name}
                    className="label-micro rounded-pill capitalize"
                    style={{
                      padding: "2px 8px",
                      backgroundColor: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    {name}
                  </span>
                ))}
                {d.benchmarkType && (
                  <span
                    className="label-micro rounded-pill capitalize"
                    style={{
                      padding: "2px 8px",
                      backgroundColor: "#5C3308",
                      color: "#F0B870",
                      border: "1px solid #D48A30",
                    }}
                  >
                    {d.benchmarkType}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
