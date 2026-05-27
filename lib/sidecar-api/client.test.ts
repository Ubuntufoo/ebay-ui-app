import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

// Mock the sidecar config before importing the client so the client uses our test URL
vi.mock('@/lib/config/sidecar', () => ({
  getSidecarConfig: () => ({ apiUrl: 'http://sidecar.test' }),
}));

// `server-only` is imported by the client implementation; mock it out for tests
vi.mock('server-only', () => ({}));

import {retryPublishListing} from './client';

describe('sidecar client - retryPublishListing', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
    global.fetch = originalFetch;
  });

  it('posts to the sidecar /listings/:id/retry endpoint', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ alreadyQueued: false, job: { job_id: 'j1' }, listing: {}, workflow: 'publish' }),
    } as unknown as Response;

    (global.fetch as unknown as any) = vi.fn().mockResolvedValue(mockResponse);

    const res = await retryPublishListing('LIST-123');

    expect((global.fetch as unknown as any).mock.calls.length).toBe(1);
    const [url, init] = (global.fetch as unknown as any).mock.calls[0];
    expect(url).toBe('http://sidecar.test/listings/LIST-123/retry');
    expect(init?.method).toBe('POST');
    expect(init?.headers && init.headers['Content-Type'] === 'application/json').toBe(true);
    expect(res).toHaveProperty('listing');
  });
});
