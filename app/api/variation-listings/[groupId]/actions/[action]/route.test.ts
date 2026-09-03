import {describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => { class MockSidecarApiError extends Error { constructor(message: string, readonly status: number, readonly response?: unknown) { super(message); } } return {runAction: vi.fn(), MockSidecarApiError}; });
vi.mock("@/lib/sidecar-api", () => ({runVariationListingAction: mocks.runAction, SidecarApiError: mocks.MockSidecarApiError}));
import {POST} from "@/app/api/variation-listings/[groupId]/actions/[action]/route";

const context = {params: Promise.resolve({groupId: "group/1", action: "publish"})};
describe("variation action proxy", () => {
  it("rejects malformed JSON", async () => {
    const response = await POST(new Request("http://local", {method: "POST", body: "{"}), context);
    expect(response.status).toBe(400);
  });
  it("preserves structured Sidecar status responses", async () => {
    const status = {summary: "Remote outcome is unknown.", stage: "publish_remote", retryStatus: "reconciliation_required", remoteState: "unknown", requiresReconciliation: true, issues: [], recommendedActions: ["reconcile_remote_state"]};
    mocks.runAction.mockRejectedValueOnce(new mocks.MockSidecarApiError(status.summary, 409, {error: "variation_listing_remote_outcome_unknown", status}));
    const response = await POST(new Request("http://local", {method: "POST", body: JSON.stringify({expectedDesiredRevision: 2})}), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(expect.objectContaining({status}));
  });
});
