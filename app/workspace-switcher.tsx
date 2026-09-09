"use client";

import Link from "next/link";
import {useCallback, useEffect, useRef, useState, type MouseEvent} from "react";

import type {
  VariationListingIntakeSession,
  VariationListingIntakeSessionResponse,
} from "@/lib/sidecar-api";

type StandardRoutingResult =
  | {success: true}
  | {success: false; error: string};

type FetchLike = typeof fetch;

async function responseError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {error?: unknown; message?: unknown} | null;
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message.trim();
  return typeof payload?.error === "string" && payload.error.trim()
    ? payload.error.trim()
    : fallback;
}

function requestError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function isIdleSession(session: VariationListingIntakeSession): boolean {
  return (
    session.mode === "idle" &&
    session.targetGroupId === null &&
    session.targetVariationId === null &&
    session.copyConditionToken === null &&
    session.pendingPair === null
  );
}

function parseRoutingSession(
  payload: unknown,
): VariationListingIntakeSession | null | undefined {
  if (!payload || typeof payload !== "object" || !("session" in payload)) {
    return undefined;
  }
  const session = (payload as {session?: unknown}).session;
  if (session === null) return null;
  if (!session || typeof session !== "object") return undefined;
  const candidate = session as Partial<VariationListingIntakeSession>;
  if (
    typeof candidate.captureSourceKey !== "string" ||
    candidate.captureSourceKey.trim().length === 0 ||
    !["idle", "new_variation", "duplicate_copy"].includes(candidate.mode ?? "") ||
    (candidate.targetGroupId !== null && typeof candidate.targetGroupId !== "string") ||
    (candidate.targetVariationId !== null && typeof candidate.targetVariationId !== "string") ||
    (candidate.copyConditionToken !== null && typeof candidate.copyConditionToken !== "string") ||
    typeof candidate.stickyPriceAmount !== "number" ||
    candidate.pendingPair === undefined
  ) {
    return undefined;
  }
  return session as VariationListingIntakeSession;
}

export async function inspectStandardCaptureRouting(
  fetchImpl: FetchLike = fetch,
): Promise<StandardRoutingResult> {
  try {
    const response = await fetchImpl("/api/variation-listings/intake-session", {
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        success: false,
        error: await responseError(
          response,
          `Unable to verify capture routing (${response.status}).`,
        ),
      };
    }
    const payload = (await response.json().catch(() => null)) as
      | VariationListingIntakeSessionResponse
      | null;
    const session = parseRoutingSession(payload);
    if (session === undefined) {
      return {
        success: false,
        error: "Unable to verify capture routing because the intake session response was malformed.",
      };
    }
    if (!session || isIdleSession(session)) return {success: true};
    return {
      success: false,
      error: session.pendingPair
        ? "Standard capture is inactive because a Variation Listing pair is currently pending."
        : "Standard capture is inactive because Variation Listing intake is armed. Select Standard listings to take capture ownership.",
    };
  } catch (error) {
    return {
      success: false,
      error: requestError(error, "Unable to verify capture routing."),
    };
  }
}

export async function ensureStandardCaptureRouting(
  fetchImpl: FetchLike = fetch,
): Promise<StandardRoutingResult> {
  try {
    const readResponse = await fetchImpl("/api/variation-listings/intake-session", {
      cache: "no-store",
    });
    if (!readResponse.ok) {
      return {
        success: false,
        error: await responseError(
          readResponse,
          `Unable to verify capture routing (${readResponse.status}).`,
        ),
      };
    }

    const readPayload = (await readResponse.json().catch(() => null)) as
      | VariationListingIntakeSessionResponse
      | null;
    const session = parseRoutingSession(readPayload);
    if (session === undefined) {
      return {
        success: false,
        error:
          "Unable to verify capture routing because the intake session response was malformed.",
      };
    }
    if (!session || isIdleSession(session)) {
      return {success: true};
    }

    if (session.pendingPair) {
      return {
        success: false,
        error:
          "Standard capture is blocked while a Variation Listing front/back pair is pending. Finish or discard that pending pair in Variation Listings first.",
      };
    }

    const writeResponse = await fetchImpl("/api/variation-listings/intake-session", {
      method: "PATCH",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        mode: "idle",
        targetGroupId: null,
        targetVariationId: null,
        copyConditionToken: null,
        stickyPriceAmount: session.stickyPriceAmount,
      }),
    });
    if (!writeResponse.ok) {
      return {
        success: false,
        error: await responseError(
          writeResponse,
          `Unable to activate Standard capture (${writeResponse.status}).`,
        ),
      };
    }

    const writePayload = (await writeResponse.json().catch(() => null)) as
      | VariationListingIntakeSessionResponse
      | null;
    const writtenSession = parseRoutingSession(writePayload);
    if (!writtenSession || !isIdleSession(writtenSession)) {
      return {
        success: false,
        error:
          "Standard capture could not be verified because Variation Listing intake did not become idle.",
      };
    }

    return {success: true};
  } catch (error) {
    return {
      success: false,
      error: requestError(error, "Unable to activate Standard capture."),
    };
  }
}

type WorkspaceSwitcherProps = {
  currentWorkspace: "standard" | "variation";
  guardStandardCaptureRouting?: boolean;
  navigate?: (href: string) => void;
  ensureStandardRouting?: () => Promise<StandardRoutingResult>;
  inspectStandardRouting?: () => Promise<StandardRoutingResult>;
  revalidateIntervalMs?: number;
};

export function WorkspaceSwitcher({
  currentWorkspace,
  guardStandardCaptureRouting = false,
  navigate = (href) => window.location.assign(href),
  ensureStandardRouting = ensureStandardCaptureRouting,
  inspectStandardRouting = inspectStandardCaptureRouting,
  revalidateIntervalMs = 2000,
}: WorkspaceSwitcherProps) {
  const [routingState, setRoutingState] = useState<
    "ready" | "checking" | "error"
  >(() =>
    currentWorkspace === "standard" && guardStandardCaptureRouting
      ? "checking"
      : "ready",
  );
  const [routingError, setRoutingError] = useState<string | null>(null);
  const routingOperationRef = useRef(0);

  const activateStandard = useCallback(async () => {
    const operation = ++routingOperationRef.current;
    setRoutingState("checking");
    setRoutingError(null);
    let result: StandardRoutingResult;
    try {
      result = await ensureStandardRouting();
    } catch (error) {
      result = {
        success: false,
        error: requestError(error, "Unable to activate Standard capture."),
      };
    }
    if (operation !== routingOperationRef.current) return false;
    if (!result.success) {
      setRoutingState("error");
      setRoutingError(result.error);
      return false;
    }
    setRoutingState("ready");
    return true;
  }, [ensureStandardRouting]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (currentWorkspace !== "standard" || !guardStandardCaptureRouting) return;
    let cancelled = false;
    const operation = ++routingOperationRef.current;
    setRoutingState("checking");
    setRoutingError(null);
    void ensureStandardRouting().then((result) => {
      if (cancelled || operation !== routingOperationRef.current) return;
      if (result.success) {
        setRoutingState("ready");
      } else {
        setRoutingState("error");
        setRoutingError(result.error);
      }
    }).catch((error) => {
      if (cancelled || operation !== routingOperationRef.current) return;
      setRoutingState("error");
      setRoutingError(requestError(error, "Unable to activate Standard capture."));
    });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace, ensureStandardRouting, guardStandardCaptureRouting]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (
      currentWorkspace !== "standard" ||
      !guardStandardCaptureRouting ||
      routingState !== "ready" ||
      revalidateIntervalMs <= 0
    ) {
      return;
    }
    let cancelled = false;
    const intervalId = window.setInterval(() => {
      const operation = ++routingOperationRef.current;
      void inspectStandardRouting().then((result) => {
        if (cancelled || operation !== routingOperationRef.current || result.success) return;
        setRoutingState("error");
        setRoutingError(result.error);
      }).catch((error) => {
        if (cancelled || operation !== routingOperationRef.current) return;
        setRoutingState("error");
        setRoutingError(requestError(error, "Unable to verify capture routing."));
      });
    }, revalidateIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    currentWorkspace,
    guardStandardCaptureRouting,
    inspectStandardRouting,
    revalidateIntervalMs,
    routingState,
  ]);

  const handleStandardClick = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>) => {
      if (currentWorkspace === "standard" && routingState === "ready") return;
      event.preventDefault();
      if (await activateStandard() && currentWorkspace !== "standard") navigate("/");
    },
    [activateStandard, currentWorkspace, navigate, routingState],
  );

  const standardReady =
    currentWorkspace === "standard" && routingState === "ready";

  return (
    <nav
      aria-label="Current workspace"
      className="ml-auto flex flex-wrap items-center justify-end gap-2"
    >
      <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400 xl:inline">
        Current workspace
      </span>
      <div className="flex items-center rounded-full border border-stone-700 bg-stone-900/70 p-1">
        <Link
          href="/"
          onClick={handleStandardClick}
          aria-current={standardReady ? "page" : undefined}
          aria-busy={routingState === "checking" ? true : undefined}
          className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
            standardReady
              ? "bg-stone-100 text-stone-950"
              : routingState === "checking"
                ? "bg-amber-200 text-amber-950"
                : "text-stone-300 hover:text-stone-50"
          }`}
        >
          {routingState === "checking" ? "Activating Standard…" : "Standard listings"}
        </Link>
        <Link
          href="/variation-listings"
          aria-current={currentWorkspace === "variation" ? "page" : undefined}
          className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
            currentWorkspace === "variation"
              ? "bg-stone-100 text-stone-950"
              : "text-stone-300 hover:text-stone-50"
          }`}
        >
          Variation listings
        </Link>
      </div>
      {routingState === "error" && routingError ? (
        <span
          role="alert"
          className="max-w-md text-right text-[11px] font-semibold text-rose-200"
        >
          {routingError}
        </span>
      ) : null}
    </nav>
  );
}
