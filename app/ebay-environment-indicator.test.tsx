import {cleanup, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {EbayEnvironmentIndicator} from "@/app/ebay-environment-indicator";

const fetchMock = vi.fn();

describe("EbayEnvironmentIndicator", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders sandbox border and badge", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          api_base_url: "https://api.sandbox.ebay.com",
          environment: "sandbox",
          marketplace_id: "EBAY_US",
          oauth_base_url: "https://auth.sandbox.ebay.com",
        }),
        {
          headers: {"content-type": "application/json"},
          status: 200,
        },
      ),
    );

    render(<EbayEnvironmentIndicator />);

    await waitFor(() => {
      expect(screen.getByText("SANDBOX")).not.toBeNull();
    });

    const border = document.querySelector('[aria-hidden="true"]');
    expect(border).not.toBeNull();
    expect(border?.className).toContain("border-2");
    expect(border?.className).toContain("border-red-600");
  });

  it("renders nothing for production", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          api_base_url: "https://api.ebay.com",
          environment: "production",
          marketplace_id: "EBAY_US",
          oauth_base_url: "https://auth.ebay.com",
        }),
        {
          headers: {"content-type": "application/json"},
          status: 200,
        },
      ),
    );

    render(<EbayEnvironmentIndicator />);

    await waitFor(() => {
      expect(screen.queryByText("SANDBOX")).toBeNull();
    });
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("renders nothing when fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("network failed"));

    render(<EbayEnvironmentIndicator />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("SANDBOX")).toBeNull();
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
