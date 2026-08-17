import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {useState} from "react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const abandonListingActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/listing-abandon-actions", () => ({
  abandonListingAction: abandonListingActionMock,
}));

import {ListingAbandonControls} from "@/app/listing-abandon-controls";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return {promise, resolve};
}

function DialogHarness({
  onAbandoned = () => undefined,
}: {
  onAbandoned?: (listingId: string) => void;
}) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return <p>Dialog closed</p>;
  }

  return (
    <ListingAbandonControls
      listingId="LIST-001"
      onAbandoned={(listingId) => {
        onAbandoned(listingId);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

describe("ListingAbandonControls", () => {
  beforeEach(() => {
    abandonListingActionMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an accessible caution dialog with irreversible details", () => {
    render(<DialogHarness />);

    const dialog = screen.getByRole("dialog", {
      name: "Confirm Listing Abandonment",
    });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(dialog.textContent).toContain("⚠");
    expect(dialog.textContent).toContain("LIST-001");
    expect(dialog.textContent).toContain("cannot be undone");
    expect(dialog.textContent).toContain("generated data");
    expect(dialog.textContent).toContain("images/files");
    expect(dialog.textContent).toContain("saved history");
  });

  it("cancels without submitting the action", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole("button", {name: "Cancel"}));

    expect(abandonListingActionMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Dialog closed")).not.toBeNull();
  });

  it("submits the selected listing ID and keeps errors visible", async () => {
    abandonListingActionMock.mockResolvedValueOnce({
      abandonedListingId: null,
      error: "Listing changed and can no longer be abandoned.",
      success: null,
    });
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole("button", {name: "Confirm"}));

    await waitFor(() => {
      expect(abandonListingActionMock).toHaveBeenCalledTimes(1);
    });
    const submittedFormData = abandonListingActionMock.mock.calls[0]?.[1];
    expect(submittedFormData).toBeInstanceOf(FormData);
    expect((submittedFormData as FormData).get("listing_id")).toBe("LIST-001");
    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      "Listing changed and can no longer be abandoned.",
    );
  });

  it("prevents duplicate confirmation while pending", async () => {
    const deferred = createDeferred<{
      abandonedListingId: string | null;
      error: string | null;
      success: string | null;
    }>();
    abandonListingActionMock.mockReturnValueOnce(deferred.promise);
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole("button", {name: "Confirm"}));

    const pendingButton = await screen.findByRole("button", {
      name: "Abandoning...",
    });
    expect(pendingButton).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", {name: "Cancel"})).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(pendingButton);
    expect(abandonListingActionMock).toHaveBeenCalledTimes(1);

    deferred.resolve({
      abandonedListingId: null,
      error: "Try again.",
      success: null,
    });
    await screen.findByRole("alert");
  });

  it("reports success and closes the dialog", async () => {
    abandonListingActionMock.mockResolvedValueOnce({
      abandonedListingId: "LIST-001",
      error: null,
      success: "Abandoned LIST-001.",
    });
    const onAbandoned = vi.fn();
    const user = userEvent.setup();
    render(<DialogHarness onAbandoned={onAbandoned} />);

    await user.click(screen.getByRole("button", {name: "Confirm"}));

    await waitFor(() => {
      expect(onAbandoned).toHaveBeenCalledWith("LIST-001");
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
