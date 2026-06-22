import { useEffect, useState } from "react";

interface TimelineEvent {
  id: number; actor_name: string; action: string; entity_id: number; detail: string | null;
  created_at: string; round: number | null; eval_status: string | null; grade: string | null;
  total_score: number | null; full_name: string | null;
  department_name: string | null; division_name: string | null;
}

const ACTION_META: Record<string, { icon: string; label: string; color: string }> = {
  submit_eval:  { icon: "📋", label: "ส่งใบประเมิน",      color: "#0891b2" },
  approve_eval: { icon: "✅", label: "อนุมัติใบประเมิน",  color: "#16a34a" },
  reject_eval:  { icon: "❌", label: "ไม่อนุมัติ",        color: "#dc2626" },
  save_eval:    { icon: "💾", label: "บันทึกร่าง",        color: "#94a3b8" },
};

function groupByDate(events: TimelineEvent[]): [string, TimelineEvent[]][] {
  const map = new Map<string, TimelineEvent[]>();
  events.forEach(ev => {
    const day = ev.created_at.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(ev);
  });
  return [...map.entries()];
}

function thaiDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
function thaiTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default function TimelineView() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/eval/timeline").then(r => r.json())
      .then((d: { ok: boolean; events: TimelineEvent[] }) => {
        setEvents(d.events ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลดประวัติ…</div>
  );

  if (events.length === 0) return (
    <div style={{ textAlign: "center", padding: 60, color: "#94a3b8",
      background: "#fff", borderRadius: 14 }}>ยังไม่มีประวัติการดำเนินการ</div>
  );

  const grouped = groupByDate(events);

  return (
    <div style={{ maxWidth: 680 }}>
      {grouped.map(([day, dayEvents]) => (
        <div key={day} style={{ marginBottom: 32 }}>
          {/* Date heading */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b",
              background: "#f8fafc", borderRadius: 20, padding: "4px 14px",
              border: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
              {thaiDate(day)}
            </div>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          {/* Events for this day */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {dayEvents.map((ev, i) => {
              const meta = ACTION_META[ev.action] ?? { icon: "📌", label: ev.action, color: "#64748b" };
              return (
                <div key={ev.id} style={{ display: "flex", gap: 14, position: "relative",
                  paddingBottom: i < dayEvents.length - 1 ? 0 : 0 }}>
                  {/* Vertical line */}
                  {i < dayEvents.length - 1 && (
                    <div style={{ position: "absolute", left: 19, top: 40, bottom: -14,
                      width: 2, background: "#e2e8f0", zIndex: 0 }} />
                  )}

                  {/* Icon bubble */}
                  <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                    background: meta.color + "18", border: `2px solid ${meta.color}33`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, zIndex: 1, position: "relative" }}>
                    {meta.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: 20 }}>
                    <div style={{ background: "#fff", borderRadius: 12,
                      border: "1px solid #f1f5f9", padding: "12px 16px",
                      boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <span style={{ fontWeight: 700, color: meta.color, fontSize: 13 }}>
                            {meta.label}
                          </span>
                          {ev.round && (
                            <span style={{ marginLeft: 8, fontSize: 12, color: "#94a3b8" }}>
                              รอบ {ev.round} วัน
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
                          {thaiTime(ev.created_at)}
                        </span>
                      </div>

                      {ev.full_name && (
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginTop: 4 }}>
                          {ev.full_name}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {[ev.department_name, ev.division_name].filter(Boolean).join(" · ")}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8,
                        flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          โดย <span style={{ color: "#475569", fontWeight: 600 }}>{ev.actor_name}</span>
                        </span>
                        {ev.total_score !== null && (
                          <span style={{ fontSize: 12, background: "#f0fdf4", color: "#16a34a",
                            borderRadius: 6, padding: "1px 8px", fontWeight: 700 }}>
                            {ev.total_score}/100{ev.grade ? ` · เกรด ${ev.grade}` : ""}
                          </span>
                        )}
                        {ev.detail && (
                          <span style={{ fontSize: 12, color: "#64748b" }}>· {ev.detail}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
