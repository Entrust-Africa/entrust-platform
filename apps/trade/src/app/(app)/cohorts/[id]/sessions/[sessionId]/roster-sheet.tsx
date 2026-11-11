"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import type { AttendanceStatus, TradeFacilitatorRoster } from "@/lib/types";
import { recordAttendanceAction, sendRemindersAction } from "../actions";

export function RosterSheet({
  roster,
}: {
  roster: TradeFacilitatorRoster;
}) {
  const [attendanceState, setAttendanceState] = useState<
    Record<string, { status: AttendanceStatus; notes: string }>
  >(() => {
    const initial: Record<string, { status: AttendanceStatus; notes: string }> = {};
    for (const sme of roster.smes) {
      for (const m of sme.members) {
        initial[m.userId] = {
          status: m.attendance?.status ?? "present",
          notes: m.attendance?.notes ?? "",
        };
      }
    }
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [reminderState, setReminderState] = useState<{
    sending: boolean;
    info: string | null;
  }>({ sending: false, info: null });

  async function handleSaveAttendance() {
    setSaving(true);
    setMessage(null);

    const records = [];
    for (const sme of roster.smes) {
      for (const m of sme.members) {
        const att = attendanceState[m.userId];
        if (att) {
          records.push({
            userId: m.userId,
            organizationId: sme.organizationId,
            status: att.status,
            notes: att.notes,
          });
        }
      }
    }

    const res = await recordAttendanceAction(roster.session.id, records);
    setSaving(false);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({
        type: "success",
        text: `Attendance recorded for ${records.length} participants. Module completion status remains decoupled and untouched.`,
      });
    }
  }

  async function handleSendReminders() {
    setReminderState({ sending: true, info: null });
    const res = await sendRemindersAction(roster.session.id);
    setReminderState({
      sending: false,
      info: res.error
        ? `Error: ${res.error}`
        : res.data?.queued
          ? `Reminded ${res.data.queued} ${res.data.queued === 1 ? "person" : "people"}. Each person is reminded once for this session time, so sending again won't repeat it.`
          : "Everyone has already been reminded about this session time.",
    });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === "success"
              ? "bg-ok-50 text-ok ring-1 ring-inset ring-ok/25"
              : "bg-danger-50 text-danger ring-1 ring-inset ring-danger/25"
          }`}
        >
          {message.text}
        </div>
      )}

      {reminderState.info && (
        <div className="rounded-md bg-info-50 p-3 text-sm text-info ring-1 ring-inset ring-info/25">
          {reminderState.info}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">
            Facilitator Preparation Roster & Attendance
          </h2>
          <p className="mt-0.5 text-xs text-ink-2">
            Inspect enrolled SMEs' preparation on covered modules before the session, and record attendance marks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleSendReminders}
            disabled={reminderState.sending}
          >
            {reminderState.sending ? "Queueing..." : "Send Reminders"}
          </Button>
          <Button variant="primary" onClick={handleSaveAttendance} disabled={saving}>
            {saving ? "Saving..." : "Save Attendance"}
          </Button>
        </div>
      </div>

      {roster.smes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-2">
          No SMEs enrolled in this cohort yet. Enrol companies on the cohort details page first.
        </Card>
      ) : (
        <div className="space-y-4">
          {roster.smes.map((sme) => (
            <Card key={sme.organizationId} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
                <div>
                  <div className="font-display font-bold text-ink">{sme.organizationName}</div>
                  <div className="text-xs text-ink-2">
                    {sme.legalName ?? "No legal profile"} • SME ID: {sme.smeId ?? "—"}
                  </div>
                </div>

                {/* Covered modules progress preview */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-ink-3">Module Prep:</span>
                  {sme.modules.map((mod) => (
                    <span
                      key={mod.moduleCode}
                      className="inline-flex items-center gap-1 rounded bg-canvas px-2 py-0.5 text-xs font-mono"
                    >
                      <span className="font-semibold text-ink">{mod.moduleCode}:</span>
                      <span
                        className={
                          mod.status === "completed"
                            ? "text-ok font-semibold"
                            : mod.status === "in_progress"
                              ? "text-info font-medium"
                              : "text-ink-3"
                        }
                      >
                        {mod.status}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Members attendance list */}
              <div className="mt-3 divide-y divide-line/60">
                {sme.members.map((member) => {
                  const current = attendanceState[member.userId] ?? {
                    status: "present",
                    notes: "",
                  };

                  return (
                    <div
                      key={member.userId}
                      className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-ink">{member.name}</div>
                        <div className="text-ink-3">{member.email} • {member.role}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Attendance status radio pills */}
                        <div className="flex items-center rounded-md border border-line bg-canvas p-0.5">
                          {(["present", "late", "absent"] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() =>
                                setAttendanceState((prev) => ({
                                  ...prev,
                                  [member.userId]: {
                                    status: st,
                                    notes: prev[member.userId]?.notes ?? "",
                                  },
                                }))
                              }
                              className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                                current.status === st
                                  ? st === "present"
                                    ? "bg-ok text-white font-bold"
                                    : st === "late"
                                      ? "bg-warn text-white font-bold"
                                      : "bg-danger text-white font-bold"
                                  : "text-ink-2 hover:text-ink"
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>

                        <input
                          type="text"
                          placeholder="Notes (optional)..."
                          value={current.notes}
                          onChange={(e) =>
                            setAttendanceState((prev) => ({
                              ...prev,
                              [member.userId]: {
                                status: prev[member.userId]?.status ?? "present",
                                notes: e.target.value,
                              },
                            }))
                          }
                          className="w-48 rounded border border-line bg-surface px-2 py-1 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
