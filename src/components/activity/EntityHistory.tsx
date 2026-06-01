"use client";

// History-on-tap (Build 14.5). A small "History" trigger that opens a modal
// listing the full create→edit→finalize→… trail for one entity, newest first.
// Fetches lazily on open via the browser Supabase client (RLS scopes it to the
// user's team). Used on collaborative-artifact detail pages (drill, practice).

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  loadEntityHistory,
  type ActivityEntityType,
  type ActivityFeedItem,
} from "@/lib/activity";

export default function EntityHistory({
  entityType,
  entityId,
  label = "History",
}: {
  entityType: ActivityEntityType;
  entityId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ActivityFeedItem[] | null>(null);

  async function openModal() {
    setOpen(true);
    if (items === null && !loading) {
      setLoading(true);
      const rows = await loadEntityHistory(supabase, entityType, entityId);
      setItems(rows);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--uff-orange, #F0B870)",
          textDecoration: "underline dotted",
          textUnderlineOffset: 2,
        }}
      >
        {label}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 460,
              maxHeight: "80vh",
              overflowY: "auto",
              background: "var(--uff-surface-raised, #161C24)",
              border: "1px solid var(--uff-line)",
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".18em",
                  color: "var(--uff-text)",
                }}
              >
                HISTORY
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--uff-text-dim)",
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {loading ? (
              <p style={{ fontSize: 13, color: "var(--uff-text-dim)" }}>Loading…</p>
            ) : !items || items.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--uff-text-dim)" }}>
                No history recorded yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {items.map((e, i) => (
                  <div
                    key={e.id}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom:
                        i < items.length - 1
                          ? "1px solid var(--uff-line-soft)"
                          : "none",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "var(--uff-text)", minWidth: 0 }}>
                      <span style={{ color: "var(--uff-text)" }}>{e.who} </span>
                      <span style={{ color: "var(--uff-text-dim)" }}>{e.verbLabel} </span>
                      <span style={{ color: "var(--uff-text)" }}>{e.what}</span>
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--uff-text-mute)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.when}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
