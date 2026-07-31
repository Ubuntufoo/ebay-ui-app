import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {useState} from "react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const deleteSandboxListingActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/listing-sandbox-delete-actions", () => ({
  deleteSandboxListingAction: deleteSandboxListingActionMock,
}));

import {ListingSandboxDeleteControls} from "@/app/listing-sandbox-delete-controls";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return {promise, resolve};
}

function DialogHarness({onDeleted = () => undefined}: {onDeleted?: (listingId: string) => void}) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return <p>Dialog closed</p>;
  }

  return (
    <ListingSandboxDeleteControls
      expectedSku="BSKBL-Single-000005"
      expectedUpdatedAt="2026-07-30T18:43:17.000Z"
      listingId="Single-000005"
      onDeleted={(listingId) => {
        onDeleted(listingId);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

describe("ListingSandboxDeleteControls", () => {
  beforeEach(() => {
    deleteSandboxListingActionMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows exact identifiers and the complete irreversible deletion warning", () => {
    render(<DialogHarness />);

    const dialog = screen.getByRole("dialog", {
      name: "Confirm Sandbox Listing Deletion",
    });
    expect(dialog.textContent).toContain("Single-000005");
    expect(dialog.textContent).toContain("BSKBL-Single-000005");
    expect(dialog.textContent).toContain("sandbox eBay listing, offer, and inventory item");
    expect(dialog.textContent).toContain("local R2 images");
    expect(dialog.textContent).toContain("watcher files");
    expect(dialog.textContent).toContain("associated jobs and history");
    expect(dialog.textContent).toContain("cannot be undone");
    expect(dialog.textContent).toContain("Sold or order-linked listings");
  });

  it("submits exact hidden fields and keeps backend errors visible", async () => {
    deleteSandboxListingActionMock.mockResolvedValueOnce({
      deletedListingId: null,
      deletedSku: null,
      error: "Listing changed. Refresh before deleting.",
      success: null,
    });
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole("button", {name: "Confirm Delete"}));

    await waitFor(() => {
      expect(deleteSandboxListingActionMock).toHaveBeenCalledTimes(1);
    });
    const formData = deleteSandboxListingActionMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("listing_id")).toBe("Single-000005");
    expect(formData.get("expected_sku")).toBe("BSKBL-Single-000005");
    expect(formData.get("expected_updated_at")).toBe(
      "2026-07-30T18:43:17.000Z",
    );
    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Listing changed");
  });

  it("disables both controls and shows Deleting while pending", async () => {
    const deferred = createDeferred<{
      deletedListingId: string | null;
      deletedSku: string | null;
      error: string | null;
      success: string | null;
    }>();
    deleteSandboxListingActionMock.mockReturnValueOnce(deferred.promise);
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole("button", {name: "Confirm Delete"}));

    const pendingButton = await screen.findByRole("button", {name: "Deleting..."});
    expect(pendingButton).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", {name: "Cancel"})).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(pendingButton);
    expect(deleteSandboxListingActionMock).toHaveBeenCalledTimes(1);

    deferred.resolve({
      deletedListingId: null,
      deletedSku: null,
      error: "Try again.",
      success: null,
    });
    await screen.findByRole("alert");
  });

  it("reports success and closes the dialog", async () => {
    deleteSandboxListingActionMock.mockResolvedValueOnce({
      deletedListingId: "Single-000005",
      deletedSku: "BSKBL-Single-000005",
      error: null,
      success: "Deleted sandbox listing BSKBL-Single-000005.",
    });
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<DialogHarness onDeleted={onDeleted} />);

    await user.click(screen.getByRole("button", {name: "Confirm Delete"}));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith("Single-000005");
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
