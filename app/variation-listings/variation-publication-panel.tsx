"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import type {SidecarErrorResponse, VariationListingActionResponse, VariationListingActionRouteName, VariationListingActionStatus, VariationListingGroup} from "@/lib/sidecar-api";

type Props = {group: VariationListingGroup | null; capturePending: boolean; onGroupUpdated: (group: VariationListingGroup) => void};
type Progress = {kind: string; stage: string};
const token = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ");

function isGroup(value: unknown, id: string): value is VariationListingGroup {
  if (!value || typeof value !== "object") return false;
  const g = value as Partial<VariationListingGroup>;
  const latest = g.journal && typeof g.journal === "object" ? g.journal.latestRevision : null;
  return g.groupId === id && Number.isInteger(g.desiredRevision) && typeof g.lifecycleState === "string" &&
    (g.lastConfirmedRevision === null || (typeof g.lastConfirmedRevision === "number" && Number.isInteger(g.lastConfirmedRevision) && g.lastConfirmedRevision >= 0)) &&
    typeof g.updatedAt === "string" && Number.isFinite(Date.parse(g.updatedAt)) && !!g.validation &&
    Array.isArray(g.validation.blockers) && typeof g.validation.initialPublicationReady === "boolean" && typeof g.validation.hasPendingChanges === "boolean" &&
    !!g.journal && (latest === null || (typeof latest === "object" && typeof latest.revisionId === "string" && Number.isInteger(latest.capturedDesiredRevision) && Array.isArray(latest.operations)));
}
function isStatus(value: unknown): value is VariationListingActionStatus {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<VariationListingActionStatus>;
  return typeof s.summary === "string" && typeof s.stage === "string" &&
    ["not_applicable", "safe_to_retry", "reconciliation_required", "retry_exhausted"].includes(s.retryStatus as string) &&
    ["known_unchanged", "known_changed", "unknown"].includes(s.remoteState as string) &&
    ["error", "warning"].includes(s.severity as string) && typeof s.requiresReconciliation === "boolean" && typeof s.userActionRequired === "boolean" && Array.isArray(s.issues) && Array.isArray(s.recommendedActions);
}

export function VariationPublicationPanel({group, capturePending, onGroupUpdated}: Props) {
  const [runningAction, setRunningAction] = useState<VariationListingActionRouteName | null>(null);
  const [status, setStatus] = useState<VariationListingActionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [confirming, setConfirming] = useState<"withdraw" | "abandon" | "cleanup" | null>(null);
  const [ambiguous, setAmbiguous] = useState(false);
  const [awaitingGroupRefresh, setAwaitingGroupRefresh] = useState(false);
  const actionLockRef = useRef(false);
  const refreshBaselineRef = useRef<string | null>(null);

  const groupId = group?.groupId;
  useEffect(() => {
    if (!groupId || typeof EventSource === "undefined") return;
    const source = new EventSource(`/api/variation-listings/${encodeURIComponent(groupId)}/actions/events`);
    const kinds = ["action_started", "action_progress", "action_succeeded", "action_failed"];
    const onEvent = (event: Event) => {
      try {
        const value = JSON.parse((event as MessageEvent).data) as Record<string, unknown>;
        if (value.groupId === groupId && typeof value.kind === "string" && typeof value.stage === "string") setProgress({kind: value.kind, stage: value.stage});
      } catch { /* supplemental progress is best effort */ }
    };
    kinds.forEach((kind) => source.addEventListener(kind, onEvent));
    return () => { kinds.forEach((kind) => source.removeEventListener(kind, onEvent)); source.close(); };
  }, [groupId]);

  const groupStateSignature = group
    ? [
        group.groupId,
        group.lifecycleState,
        group.desiredRevision,
        group.lastConfirmedRevision ?? "null",
        group.updatedAt,
        group.journal.latestRevision?.revisionId ?? "null",
        group.journal.latestRevision?.capturedDesiredRevision ?? "null",
        group.journal.latestRevision?.recovery?.retryStatus ?? "null",
        group.journal.latestRevision?.recovery?.operationKey ?? "null",
      ].join("|")
    : null;

  useEffect(() => {
    const baseline = refreshBaselineRef.current;
    if (baseline !== null) {
      if (groupStateSignature !== null && groupStateSignature !== baseline) {
        refreshBaselineRef.current = null;
        actionLockRef.current = false;
        setAwaitingGroupRefresh(false);
        setAmbiguous(false);
      }
      return;
    }
    actionLockRef.current = false;
    setAmbiguous(false);
  }, [groupStateSignature]);

  const refreshRequiredWarning = (value: VariationListingActionStatus) =>
    value.code === "group_refresh_required" ||
    (value.remoteState === "known_changed" && value.recommendedActions.some((action) => /refresh/i.test(action)));

  const runAction = useCallback(async (action: VariationListingActionRouteName) => {
    if (!group || runningAction || actionLockRef.current || awaitingGroupRefresh) return;
    actionLockRef.current = true;
    setRunningAction(action); setStatus(null); setError(null); setConfirming(null);
    try {
      const body = action === "retry" ? {} : {expectedDesiredRevision: group.desiredRevision};
      const response = await fetch(`/api/variation-listings/${encodeURIComponent(group.groupId)}/actions/${action}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
      const payload = (await response.json().catch(() => null)) as VariationListingActionResponse | SidecarErrorResponse | null;
      const responseStatus = payload && typeof payload === "object" && "status" in payload && isStatus(payload.status) ? payload.status : undefined;
      if (!response.ok) { if (responseStatus) setStatus(responseStatus); else { setError("Action outcome is ambiguous; refresh before retrying."); setAmbiguous(true); } if (responseStatus && !responseStatus.requiresReconciliation && responseStatus.retryStatus !== "retry_exhausted" && responseStatus.remoteState !== "unknown") actionLockRef.current = false; else setAmbiguous(true); throw new Error(responseStatus?.summary ?? (payload && "message" in payload ? payload.message : undefined) ?? (payload && "error" in payload ? payload.error : undefined) ?? `Variation listing action failed (${response.status}).`); }
      if (!payload || typeof payload !== "object" || !("group" in payload) || (payload.group !== null && !isGroup(payload.group, group.groupId))) { setAmbiguous(true); throw new Error("Variation listing action returned a malformed response."); }
      if ("warning" in payload && isStatus(payload.warning)) {
        setStatus(payload.warning);
        if (payload.warning.requiresReconciliation || payload.warning.retryStatus === "retry_exhausted" || payload.warning.remoteState === "unknown") {
          setAmbiguous(true);
          throw new Error(payload.warning.summary);
        }
      }
      if (payload.group !== null) {
        onGroupUpdated(payload.group);
        actionLockRef.current = false;
      } else {
        refreshBaselineRef.current = groupStateSignature;
        setAwaitingGroupRefresh(true);
        if ("warning" in payload && isStatus(payload.warning) && refreshRequiredWarning(payload.warning)) {
          setStatus(payload.warning);
        }
      }
    } catch (caught) { if (actionLockRef.current) setAmbiguous(true); setError(caught instanceof Error ? caught.message : "Unable to run variation listing action."); }
    finally { setRunningAction(null); }
  }, [awaitingGroupRefresh, group, groupStateSignature, onGroupUpdated, runningAction]);

  if (!group) return <section className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white/65 p-6 text-center text-sm text-stone-500">Select a bucket to review publication readiness and revision state.</section>;
  const latest = group.journal.latestRevision;
  const recovery = latest?.recovery;
  const confirmed = group.lastConfirmedRevision !== null;
  const active = group.lifecycleState === "active" && confirmed;
  const blockedByRecovery = !!recovery && (recovery.retryStatus !== "not_applicable" || recovery.requiresReconciliation || recovery.remoteState === "unknown");
  const actionStateLocked = awaitingGroupRefresh || ambiguous;
  const initialReady = !capturePending && !runningAction && !blockedByRecovery && !actionStateLocked && !confirmed && (group.lifecycleState === "review" || group.lifecycleState === "publish-ready") && group.validation.initialPublicationReady;
  const changesReady = !capturePending && !runningAction && !blockedByRecovery && !actionStateLocked && active && group.validation.hasPendingChanges;
  const retryReady = !capturePending && !runningAction && !actionStateLocked && recovery?.retryStatus === "safe_to_retry";
  const withdrawReady = !capturePending && !runningAction && !blockedByRecovery && !actionStateLocked && active && group.desiredRevision === group.lastConfirmedRevision;
  const unpublishedBase = !confirmed && !blockedByRecovery && !actionStateLocked && !["abandoned", "withdrawn", "cleanup", "terminal-absent"].includes(group.lifecycleState);
  const hasClearRecoveryState = !!recovery && recovery.retryStatus === "not_applicable" && !recovery.requiresReconciliation && recovery.remoteState !== "unknown";
  const hasFrozenUnpublishedRevision = unpublishedBase && hasClearRecoveryState && latest !== null && latest.revisionId.length > 0 && latest.capturedDesiredRevision === group.desiredRevision;
  const abandonReady = unpublishedBase && (group.desiredRevision === 0 || hasFrozenUnpublishedRevision);
  const cleanupReady = unpublishedBase && hasFrozenUnpublishedRevision;
  const destructive = (action: "withdraw" | "abandon" | "cleanup") => confirming === action ? void runAction(action) : setConfirming(action);
  return <section className="rounded-[1.5rem] border border-stone-950/10 bg-white/90 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Publication</p><h2 className="mt-1 text-xl font-semibold">Staged revision status</h2><p className="mt-1 text-sm leading-6 text-stone-600">Publish reviewed revisions and recover interrupted remote actions from durable backend state.</p></div><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold">{group.validation.hasPendingChanges ? "Changes staged" : "Remote revision synced"}</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Lifecycle", token(group.lifecycleState)], ["Desired revision", String(group.desiredRevision)], ["Confirmed revision", group.lastConfirmedRevision === null ? "Not published" : String(group.lastConfirmedRevision)]].map(([label, value]) => <div key={label} className="rounded-xl bg-stone-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}</div>
    {capturePending ? <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Publication is locked while an intake image pair is pending.</p> : null}
    {group.validation.blockers.length > 0 ? <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900"><p className="font-bold">Publication blockers</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{group.validation.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : null}
    {confirmed ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Published destructive cleanup remains blocked until YP8 proves sold/order protection.</p> : null}
    {recovery && recovery.retryStatus !== "not_applicable" ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900"><p className="font-bold">Recovery: {token(recovery.retryStatus)}</p><p className="mt-1">Stage remote state: {token(recovery.remoteState)} · {recovery.requiresReconciliation ? "reconciliation required" : "reconciliation not required"}</p><p className="mt-1">Revision: {recovery.revisionId}{recovery.operationKey ? ` · operation: ${recovery.operationKey}` : ""}</p><p className="mt-1">Recommended: {recovery.recommendedActions.join(", ") || "inspect durable history"}</p></div> : null}
    <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void runAction("publish")} disabled={!initialReady} className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-stone-300">{runningAction === "publish" ? "Publishing…" : "Publish"}</button><button type="button" onClick={() => void runAction("publish-changes")} disabled={!changesReady} className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-stone-300">{runningAction === "publish-changes" ? "Publishing…" : "Publish Changes"}</button><button type="button" onClick={() => void runAction("retry")} disabled={!retryReady} className="rounded-full border border-amber-500 px-4 py-2 text-sm font-bold text-amber-900 disabled:cursor-not-allowed disabled:opacity-40">{runningAction === "retry" ? "Retrying…" : "Retry"}</button><button type="button" onClick={() => destructive("withdraw")} disabled={!withdrawReady} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">{confirming === "withdraw" ? "Confirm Withdraw" : "Withdraw"}</button><button type="button" onClick={() => destructive("abandon")} disabled={!abandonReady || capturePending || !!runningAction} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">{confirming === "abandon" ? "Confirm Abandon" : "Abandon"}</button><button type="button" onClick={() => destructive("cleanup")} disabled={!cleanupReady || capturePending || !!runningAction} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">{confirming === "cleanup" ? "Confirm Cleanup" : "Cleanup"}</button></div>
    {progress ? <div className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-xs text-sky-900"><p className="font-bold">Live action progress: {token(progress.kind)}</p><p className="mt-1">Stage: {token(progress.stage)}</p></div> : null}
    {status ? <div className={`mt-4 rounded-xl px-4 py-3 text-xs ${status.severity === "error" ? "bg-rose-50 text-rose-900" : "bg-amber-50 text-amber-900"}`}><p className="font-bold">{status.summary}</p><p className="mt-1">Stage: {token(status.stage)} · remote: {token(status.remoteState)} · retry: {token(status.retryStatus)} · reconciliation: {status.requiresReconciliation ? "required" : "not required"}</p>{status.diagnostic ? <p className="mt-1">{status.diagnostic}</p> : null}{status.recommendedActions.length > 0 ? <p className="mt-1">Recommended: {status.recommendedActions.join(", ")}</p> : null}{status.issues.length > 0 ? <ul className="mt-2 list-disc pl-5">{status.issues.map((issue, index) => <li key={`${issue.code ?? "issue"}-${index}`}>{issue.message}</li>)}</ul> : null}</div> : null}
    {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p> : null}
    {latest && Array.isArray(latest.operations) ? <div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Latest durable operation plan</p><div className="mt-2 space-y-2">{latest.operations.map((operation) => <div key={operation.operationKey} className="flex flex-wrap justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2 text-xs"><span className="font-semibold">{token(operation.operationKind)}</span><span className="text-stone-500">{token(operation.state)} · attempt {operation.attemptNumber || "—"}</span></div>)}</div></div> : null}
  </section>;
}
