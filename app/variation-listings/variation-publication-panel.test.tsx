import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {VariationPublicationPanel} from "@/app/variation-listings/variation-publication-panel";
import type {VariationListingGroup} from "@/lib/sidecar-api";

const fetchMock = vi.fn();
class EventSourceMock {
  static instances: EventSourceMock[] = [];
  listeners = new Map<string, EventListener>();
  close = vi.fn();
  addEventListener = (kind: string, listener: EventListener) => { this.listeners.set(kind, listener); };
  removeEventListener = (kind: string) => { this.listeners.delete(kind); };
  constructor() { EventSourceMock.instances.push(this); }
  emit(kind: string, data: unknown) { this.listeners.get(kind)?.({data: JSON.stringify(data)} as MessageEvent); }
}

function group(overrides: Partial<VariationListingGroup> = {}): VariationListingGroup {
  return {...({groupId: "group-1", lifecycleState: "active", desiredRevision: 4, lastConfirmedRevision: 3, title: "Cards", validation: {blockers: [], initialPublicationReady: false, hasPendingChanges: true}, journal: {latestRevision: null}, updatedAt: "2026-09-03T00:00:00Z"} as unknown as VariationListingGroup), ...overrides};
}

describe("VariationPublicationPanel", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); EventSourceMock.instances = []; });
  it("gates publish changes by active confirmation and sends the current CAS revision", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({group: group({desiredRevision: 5, lastConfirmedRevision: 5, validation: {blockers: [], initialPublicationReady: false, hasPendingChanges: false}})}), {status: 200}));
    const updated = vi.fn();
    render(<VariationPublicationPanel group={group()} capturePending={false} onGroupUpdated={updated} />);
    fireEvent.click(screen.getByRole("button", {name: "Publish Changes"}));
    await act(async () => await Promise.resolve());
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({expectedDesiredRevision: 4}));
    expect(updated).toHaveBeenCalled();
  });
  it("locks a successful group-refresh-required action until authoritative group state changes", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const warning = {
      action: "publish_changes",
      affected: {groupId: "group-1"},
      category: "state",
      code: "group_refresh_required",
      issues: [],
      recommendedActions: ["refresh_group", "do_not_retry_action"],
      remoteState: "known_changed",
      requiresReconciliation: false,
      retryStatus: "not_applicable",
      severity: "warning",
      stage: "complete",
      summary: "Action completed; refresh the group before continuing.",
      userActionRequired: true,
    };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({group: null, warning}), {status: 200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({group: group({desiredRevision: 6})}), {status: 200}));
    const view = render(<VariationPublicationPanel group={group()} capturePending={false} onGroupUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", {name: "Publish Changes"}));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(warning.summary)).not.toBeNull();
    expect(screen.getByRole("button", {name: "Publish Changes"})).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", {name: "Publish Changes"}));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    view.rerender(<VariationPublicationPanel group={group({desiredRevision: 6})} capturePending={false} onGroupUpdated={vi.fn()} />);
    await act(async () => await Promise.resolve());
    expect(screen.getByRole("button", {name: "Publish Changes"})).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByRole("button", {name: "Publish Changes"}));
    await act(async () => await Promise.resolve());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("only enables retry for authoritative safe-to-retry recovery and renders blockers", () => {
    vi.stubGlobal("EventSource", EventSourceMock);
    render(<VariationPublicationPanel group={group({validation: {blockers: ["Missing title"], initialPublicationReady: false, hasPendingChanges: true}, journal: {latestRevision: {recovery: {revisionId: "r1", retryStatus: "reconciliation_required", remoteState: "unknown", requiresReconciliation: true, recommendedActions: ["reconcile_remote_state"]}} as unknown as VariationListingGroup["journal"]["latestRevision"]}})} capturePending={false} onGroupUpdated={vi.fn()} />);
    expect(screen.getByText("Missing title")).not.toBeNull();
    expect(screen.getByRole("button", {name: "Retry"})).toHaveProperty("disabled", true);
  });
  it("closes selected-group SSE on unmount and shows supplemental progress", () => {
    vi.stubGlobal("EventSource", EventSourceMock);
    const {unmount} = render(<VariationPublicationPanel group={group()} capturePending={false} onGroupUpdated={vi.fn()} />);
    const source = EventSourceMock.instances[0]!;
    act(() => source.emit("action_progress", {groupId: "group-1", kind: "action_progress", stage: "execute_publication"}));
    expect(screen.getByText("Live action progress: action progress")).not.toBeNull();
    unmount();
    expect(source.close).toHaveBeenCalled();
  });
  it("posts a safe retry once and locks controls during the request", async () => {
    vi.stubGlobal("EventSource", EventSourceMock); vi.stubGlobal("fetch", fetchMock);
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    const retryGroup = group({journal: {latestRevision: {recovery: {revisionId: "r1", retryStatus: "safe_to_retry", remoteState: "known_unchanged", requiresReconciliation: false, recommendedActions: ["retry_action"]}, operations: []} as unknown as VariationListingGroup["journal"]["latestRevision"]}});
    render(<VariationPublicationPanel group={retryGroup} capturePending={false} onGroupUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", {name: "Retry"}));
    expect(screen.getByRole("button", {name: "Retrying…"})).toHaveProperty("disabled", true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(new Response(JSON.stringify({group: retryGroup}), {status: 200})); await act(async () => await Promise.resolve());
  });
  it("fails closed for retry exhaustion and malformed action success", async () => {
    vi.stubGlobal("EventSource", EventSourceMock); vi.stubGlobal("fetch", fetchMock);
    const exhausted = group({journal: {latestRevision: {recovery: {revisionId: "r1", retryStatus: "retry_exhausted", remoteState: "known_unchanged", requiresReconciliation: false, recommendedActions: []}, operations: []} as unknown as VariationListingGroup["journal"]["latestRevision"]}});
    const view = render(<VariationPublicationPanel group={exhausted} capturePending={false} onGroupUpdated={vi.fn()} />);
    expect(screen.getByRole("button", {name: "Retry"})).toHaveProperty("disabled", true);
    view.rerender(<VariationPublicationPanel group={group()} capturePending={false} onGroupUpdated={vi.fn()} />);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), {status: 200}));
    fireEvent.click(screen.getByRole("button", {name: "Publish Changes"}));
    await act(async () => await Promise.resolve());
    expect(screen.getByText(/malformed response/)).not.toBeNull();
    expect(screen.getByRole("button", {name: "Publish Changes"})).toHaveProperty("disabled", true);
  });
  it("requires confirmation before withdrawal", () => {
    vi.stubGlobal("EventSource", EventSourceMock); vi.stubGlobal("fetch", fetchMock);
    render(<VariationPublicationPanel group={group({desiredRevision: 3})} capturePending={false} onGroupUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", {name: "Withdraw"}));
    expect(screen.getByRole("button", {name: "Confirm Withdraw"})).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("allows confirmation for untouched unpublished abandonment while keeping cleanup gated", () => {
    vi.stubGlobal("EventSource", EventSourceMock); vi.stubGlobal("fetch", fetchMock);
    const {unmount} = render(<VariationPublicationPanel group={group({desiredRevision: 0, lastConfirmedRevision: null, lifecycleState: "review"})} capturePending={false} onGroupUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", {name: "Abandon"}));
    expect(screen.getByRole("button", {name: "Confirm Abandon"})).not.toBeNull();
    expect(screen.getByRole("button", {name: "Cleanup"})).toHaveProperty("disabled", true);
    unmount();
    render(<VariationPublicationPanel group={group()} capturePending={false} onGroupUpdated={vi.fn()} />);
    expect(screen.getByRole("button", {name: "Cleanup"})).toHaveProperty("disabled", true);
  });
  it("fails closed for non-empty unpublished groups without a frozen journal revision", () => {
    vi.stubGlobal("EventSource", EventSourceMock); vi.stubGlobal("fetch", fetchMock);
    render(<VariationPublicationPanel group={group({desiredRevision: 4, lastConfirmedRevision: null, lifecycleState: "review", journal: {latestRevision: null}})} capturePending={false} onGroupUpdated={vi.fn()} />);
    expect(screen.getByRole("button", {name: "Abandon"})).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", {name: "Cleanup"})).toHaveProperty("disabled", true);
  });
  it("allows unpublished cleanup only with matching frozen revision evidence", () => {
    vi.stubGlobal("EventSource", EventSourceMock); vi.stubGlobal("fetch", fetchMock);
    const latestRevision = {
      revisionId: "revision-4",
      capturedDesiredRevision: 4,
      operationCount: 1,
      capturedAt: "2026-09-03T00:00:00Z",
      hasUnknownOutcome: false,
      retryExhausted: false,
      recovery: {revisionId: "revision-4", retryStatus: "not_applicable", remoteState: "known_unchanged", requiresReconciliation: false, recommendedActions: []},
      operations: [{operationKey: "op-1", operationKind: "publish", state: "succeeded", observedRemoteState: "absent", attemptNumber: 1, checkpointNumber: 1}],
    } as unknown as VariationListingGroup["journal"]["latestRevision"];
    render(<VariationPublicationPanel group={group({desiredRevision: 4, lastConfirmedRevision: null, lifecycleState: "review", journal: {latestRevision}})} capturePending={false} onGroupUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", {name: "Cleanup"}));
    expect(screen.getByRole("button", {name: "Confirm Cleanup"})).not.toBeNull();
  });
  it("renders structured reconciliation guidance and blocks replay", async () => {
    vi.stubGlobal("EventSource", EventSourceMock); vi.stubGlobal("fetch", fetchMock);
    const status = {summary: "Remote outcome is unknown.", stage: "publish_remote", retryStatus: "reconciliation_required", remoteState: "unknown", requiresReconciliation: true, userActionRequired: true, severity: "error", issues: [], recommendedActions: ["reconcile_remote_state"]};
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({error: "unknown", status}), {status: 409}));
    render(<VariationPublicationPanel group={group()} capturePending={false} onGroupUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", {name: "Publish Changes"}));
    await act(async () => await Promise.resolve());
    expect(screen.getByText(/reconciliation: required/)).not.toBeNull();
    expect(screen.getByText(/Recommended: reconcile_remote_state/)).not.toBeNull();
    expect(screen.getByRole("button", {name: "Publish Changes"})).toHaveProperty("disabled", true);
  });
  it("rejects a shallow action group payload", async () => {
    vi.stubGlobal("EventSource", EventSourceMock); vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({group: {groupId: "group-1", desiredRevision: 5, lifecycleState: "active", validation: {blockers: []}, journal: {}}}), {status: 200}));
    render(<VariationPublicationPanel group={group()} capturePending={false} onGroupUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", {name: "Publish Changes"}));
    await act(async () => await Promise.resolve());
    expect(screen.getByText(/malformed response/)).not.toBeNull();
  });
});
