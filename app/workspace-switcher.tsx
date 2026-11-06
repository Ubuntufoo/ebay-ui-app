"use client";

import Link from "next/link";
import {useCallback, useEffect, useRef, useState, type MouseEvent} from "react";
import {isVariationListingIntakeSession} from "@/lib/sidecar-api/types";

import type {
  VariationListingCaptureWorkspace,
  VariationListingIntakeSession,
  VariationListingIntakeSessionResponse,
} from "@/lib/sidecar-api";

type StandardRoutingResult =
  | {success: true; captureActive?: boolean}
  | {success: false; error: string};

type FetchLike = typeof fetch;

type RoutingSnapshot = {
  captureWorkspace: VariationListingCaptureWorkspace;
  session: VariationListingIntakeSession | null;
};

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
): RoutingSnapshot | undefined {
  if (!payload || typeof payload !== "object" || !("session" in payload)) {
    return undefined;
  }
  const candidatePayload = payload as {
    session?: unknown;
    captureWorkspace?: unknown;
  };
  if (candidatePayload.captureWorkspace !== "standard" && candidatePayload.captureWorkspace !== "variation") {
    return undefined;
  }
  const session = candidatePayload.session;
  if (session === null) {
    return {captureWorkspace: candidatePayload.captureWorkspace, session: null};
  }
  if (!session || typeof session !== "object") return undefined;
  if (!isVariationListingIntakeSession(session)) return undefined;
  return {
    captureWorkspace: candidatePayload.captureWorkspace,
    session,
  };
}

function activeVariationRouting(snapshot: RoutingSnapshot): StandardRoutingResult {
  const session = snapshot.session;
  const active = session?.mode === "new_variation" || session?.mode === "duplicate_copy" ||
    session?.pendingPair != null || session?.processingStatus?.phase === "generating_identity" ||
    session?.processingStatus?.phase === "saving";
  return active ? {success: true, captureActive: true} : {success: true};
}

function malformedRoutingResult(): StandardRoutingResult {
  return {
    success: false,
    error: "Unable to verify capture routing because the intake session response was malformed.",
  };
}

function workspaceRoutingError(workspace: VariationListingCaptureWorkspace): string {
  return workspace === "standard"
    ? "Standard capture is not authoritative for this browser."
    : "Variation capture is not authoritative for this browser.";
}

export async function inspectStandardCaptureRouting(
  fetchImpl: FetchLike = fetch,
  signal?: AbortSignal,
): Promise<StandardRoutingResult> {
  try {
    const response = await fetchImpl("/api/variation-listings/intake-session", {
      cache: "no-store",
      ...(signal ? {signal} : {}),
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
    const snapshot = parseRoutingSession(payload);
    if (!snapshot) return malformedRoutingResult();
    if (snapshot.captureWorkspace === "standard" &&
      (!snapshot.session || isIdleSession(snapshot.session))) return {success: true};
    return {
      success: false,
      error: snapshot.session?.pendingPair
        ? "Standard capture is inactive because a Variation Listing pair is currently pending."
        : workspaceRoutingError("standard"),
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
    const snapshot = parseRoutingSession(readPayload);
    if (!snapshot) return malformedRoutingResult();
    if (snapshot.captureWorkspace === "standard" &&
      (!snapshot.session || isIdleSession(snapshot.session))) {
      return {success: true};
    }

    if (snapshot.session?.pendingPair) {
      return {
        success: false,
        error:
          "Standard capture is blocked while a Variation Listing front/back pair is pending. Finish or discard that pending pair in Variation Listings first.",
      };
    }

    const writeResponse = await fetchImpl("/api/variation-listings/intake-session", {
      method: "PATCH",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({captureWorkspace: "standard"}),
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
    const writtenSnapshot = parseRoutingSession(writePayload);
    if (!writtenSnapshot || writtenSnapshot.captureWorkspace !== "standard" ||
      (writtenSnapshot.session !== null && !isIdleSession(writtenSnapshot.session))) {
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

export async function inspectVariationCaptureRouting(
  fetchImpl: FetchLike = fetch,
  signal?: AbortSignal,
): Promise<StandardRoutingResult> {
  try {
    const response = await fetchImpl("/api/variation-listings/intake-session", {
      cache: "no-store",
      ...(signal ? {signal} : {}),
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
    const snapshot = parseRoutingSession(await response.json().catch(() => null));
    if (!snapshot) return malformedRoutingResult();
    if (snapshot.captureWorkspace === "variation") return activeVariationRouting(snapshot);
    return {
      success: false,
      error: snapshot.session?.pendingPair
        ? "Variation capture is unavailable because a pending pair is owned by Standard capture."
        : workspaceRoutingError("variation"),
    };
  } catch (error) {
    return {
      success: false,
      error: requestError(error, "Unable to verify capture routing."),
    };
  }
}

export async function ensureVariationCaptureRouting(
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
    const snapshot = parseRoutingSession(await readResponse.json().catch(() => null));
    if (!snapshot) return malformedRoutingResult();
    if (snapshot.captureWorkspace === "variation") return activeVariationRouting(snapshot);
    if (snapshot.session?.pendingPair) {
      return {
        success: false,
        error: "Variation capture is unavailable because a pending pair is owned by Standard capture.",
      };
    }

    const writeResponse = await fetchImpl("/api/variation-listings/intake-session", {
      method: "PATCH",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({captureWorkspace: "variation"}),
    });
    if (!writeResponse.ok) {
      return {
        success: false,
        error: await responseError(
          writeResponse,
          `Unable to activate Variation capture (${writeResponse.status}).`,
        ),
      };
    }
    const writtenSnapshot = parseRoutingSession(await writeResponse.json().catch(() => null));
    if (!writtenSnapshot || writtenSnapshot.captureWorkspace !== "variation") {
      return {
        success: false,
        error: "Variation capture could not be verified because ownership did not become authoritative.",
      };
    }
    return activeVariationRouting(writtenSnapshot);
  } catch (error) {
    return {
      success: false,
      error: requestError(error, "Unable to activate Variation capture."),
    };
  }
}

const inspectStandardWithSignal = (signal?: AbortSignal) => inspectStandardCaptureRouting(fetch, signal);
const inspectVariationWithSignal = (signal?: AbortSignal) => inspectVariationCaptureRouting(fetch, signal);

type WorkspaceSwitcherProps = {
  currentWorkspace: "standard" | "variation";
  guardStandardCaptureRouting?: boolean;
  guardVariationCaptureRouting?: boolean;
  navigate?: (href: string) => void;
  ensureStandardRouting?: () => Promise<StandardRoutingResult>;
  inspectStandardRouting?: (signal?: AbortSignal) => Promise<StandardRoutingResult>;
  ensureVariationRouting?: () => Promise<StandardRoutingResult>;
  inspectVariationRouting?: (signal?: AbortSignal) => Promise<StandardRoutingResult>;
  revalidateIntervalMs?: number;
};

export function WorkspaceSwitcher({
  currentWorkspace,
  guardStandardCaptureRouting = false,
  guardVariationCaptureRouting = false,
  navigate = (href) => window.location.assign(href),
  ensureStandardRouting = ensureStandardCaptureRouting,
  inspectStandardRouting = inspectStandardWithSignal,
  ensureVariationRouting = ensureVariationCaptureRouting,
  inspectVariationRouting = inspectVariationWithSignal,
  revalidateIntervalMs,
}: WorkspaceSwitcherProps) {
  const [routingState, setRoutingState] = useState<
    "ready" | "checking" | "error"
  >(() =>
    ((currentWorkspace === "standard" && guardStandardCaptureRouting) ||
      (currentWorkspace === "variation" && guardVariationCaptureRouting))
      ? "checking"
      : "ready",
  );
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [captureActive, setCaptureActive] = useState(false);
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

  const activateVariation = useCallback(async () => {
    const operation = ++routingOperationRef.current;
    setRoutingState("checking");
    setRoutingError(null);
    let result: StandardRoutingResult;
    try {
      result = await ensureVariationRouting();
    } catch (error) {
      result = {
        success: false,
        error: requestError(error, "Unable to activate Variation capture."),
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
  }, [ensureVariationRouting]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (
      (currentWorkspace === "standard" && !guardStandardCaptureRouting) ||
      (currentWorkspace === "variation" && !guardVariationCaptureRouting) ||
      (currentWorkspace !== "standard" && currentWorkspace !== "variation")
    ) return;
    let cancelled = false;
    const operation = ++routingOperationRef.current;
    setRoutingState("checking");
    setRoutingError(null);
    const ensureRouting = currentWorkspace === "standard" ? ensureStandardRouting : ensureVariationRouting;
    void ensureRouting().then((result) => {
      if (cancelled || operation !== routingOperationRef.current) return;
      if (result.success) {
        setCaptureActive(result.captureActive === true);
        setRoutingState("ready");
      } else {
        setRoutingState("error");
        setRoutingError(result.error);
      }
    }).catch((error) => {
      if (cancelled || operation !== routingOperationRef.current) return;
      setRoutingState("error");
      setRoutingError(requestError(error, `Unable to activate ${currentWorkspace === "standard" ? "Standard" : "Variation"} capture.`));
    });
    return () => {
      cancelled = true;
    };
  }, [
    currentWorkspace,
    ensureStandardRouting,
    ensureVariationRouting,
    guardStandardCaptureRouting,
    guardVariationCaptureRouting,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // The workspace owns capture state; this event avoids waiting for an idle
  // interval after the user arms or disarms within the current tab.
  useEffect(() => {
    if (currentWorkspace !== "variation") return;
    const onIntakeActivity = (event: Event) => {
      const active = (event as CustomEvent<unknown>).detail;
      if (typeof active === "boolean") setCaptureActive(active);
    };
    window.addEventListener("variation-intake-activity", onIntakeActivity);
    return () => window.removeEventListener("variation-intake-activity", onIntakeActivity);
  }, [currentWorkspace]);

  const pollingIntervalMs = revalidateIntervalMs ?? (captureActive ? 2_000 : 60_000);
  useEffect(() => {
    if (
      (currentWorkspace === "standard" && !guardStandardCaptureRouting) ||
      (currentWorkspace === "variation" && !guardVariationCaptureRouting) ||
      routingState !== "ready" ||
      pollingIntervalMs <= 0
    ) return;

    let cancelled = false;
    let timeoutId: number | null = null;
    let controller: AbortController | null = null;
    let generation = 0;
    const inspectRouting = currentWorkspace === "standard" ? inspectStandardRouting : inspectVariationRouting;

    const schedule = () => {
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        void refresh();
      }, pollingIntervalMs);
    };
    const refresh = async () => {
      const runId = ++generation;
      const currentController = new AbortController();
      controller?.abort();
      controller = currentController;
      const operation = ++routingOperationRef.current;
      try {
        const result = await inspectRouting(currentController.signal);
        if (cancelled || currentController.signal.aborted || runId !== generation ||
            operation !== routingOperationRef.current || document.visibilityState !== "visible") return;
        if (result.success) {
          setCaptureActive(result.captureActive === true);
        } else {
          setRoutingState("error");
          setRoutingError(result.error);
        }
      } catch (error) {
        if (!cancelled && !currentController.signal.aborted && runId === generation &&
            operation === routingOperationRef.current && document.visibilityState === "visible") {
          setRoutingState("error");
          setRoutingError(requestError(error, "Unable to verify capture routing."));
        }
      } finally {
        if (controller === currentController) controller = null;
        if (!cancelled && runId === generation && document.visibilityState === "visible") schedule();
      }
    };
    const onVisibilityChange = () => {
      generation += 1;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = null;
      controller?.abort();
      routingOperationRef.current += 1;
      if (document.visibilityState === "visible") void refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (document.visibilityState === "visible") schedule();
    return () => {
      cancelled = true;
      generation += 1;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      controller?.abort();
    };
  }, [
    currentWorkspace,
    guardStandardCaptureRouting,
    inspectStandardRouting,
    inspectVariationRouting,
    pollingIntervalMs,
    routingState,
    guardVariationCaptureRouting,
  ]);

  const handleStandardClick = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>) => {
      if (currentWorkspace === "standard" && routingState === "ready") return;
      event.preventDefault();
      if (await activateStandard() && currentWorkspace !== "standard") navigate("/");
    },
    [activateStandard, currentWorkspace, navigate, routingState],
  );

  const handleVariationClick = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>) => {
      if (currentWorkspace === "variation" && routingState === "ready") return;
      event.preventDefault();
      if (await activateVariation() && currentWorkspace !== "variation") navigate("/variation-listings");
    },
    [activateVariation, currentWorkspace, navigate, routingState],
  );

  const standardReady =
    currentWorkspace === "standard" && routingState === "ready";
  const variationReady =
    currentWorkspace === "variation" && routingState === "ready";

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
          {routingState === "checking" && currentWorkspace === "standard" ? "Activating Standard…" : "Standard listings"}
        </Link>
        <Link
          href="/variation-listings"
          onClick={handleVariationClick}
          aria-current={variationReady ? "page" : undefined}
          aria-busy={routingState === "checking" && currentWorkspace === "variation" ? true : undefined}
          className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
            variationReady
              ? "bg-stone-100 text-stone-950"
              : "text-stone-300 hover:text-stone-50"
          }`}
        >
          {routingState === "checking" && currentWorkspace === "variation" ? "Activating Variation…" : "Variation listings"}
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
