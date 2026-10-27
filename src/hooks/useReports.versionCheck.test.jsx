import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/client', () => ({
  default: {
    getReportVersion: vi.fn(),
    getFullReport: vi.fn(),
  },
}));

import api from '../api/client';
import { REPORT_VERSION_POLL_MS, useFullReport } from './useReports';

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useFullReport version check', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.getFullReport.mockReset().mockResolvedValue({ totalAppointments: 1 });
    api.getReportVersion.mockReset().mockResolvedValue('v1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rebuilds the report only when the source version changes', async () => {
    renderHook(() => useFullReport('tustin', '2026-10-27', 'viewer-version-test'));
    await flush();
    expect(api.getFullReport).toHaveBeenCalledTimes(1);
    expect(api.getReportVersion).toHaveBeenCalledWith('2026-10-27', 'G0X353MBKGTCW', expect.any(Object));

    await act(async () => { vi.advanceTimersByTime(REPORT_VERSION_POLL_MS); });
    await flush();
    expect(api.getFullReport).toHaveBeenCalledTimes(1);

    api.getReportVersion.mockResolvedValue('v2');
    await act(async () => { vi.advanceTimersByTime(REPORT_VERSION_POLL_MS); });
    await flush();
    await flush();
    expect(api.getFullReport).toHaveBeenCalledTimes(2);
  });

  it('never interrupts a report that is still loading', async () => {
    renderHook(() => useFullReport('costa-mesa', '2026-10-27', 'viewer-version-inflight'));
    await flush();
    expect(api.getFullReport).toHaveBeenCalledTimes(1);

    // The next build hangs; a changed version must not abort or restart it.
    api.getFullReport.mockImplementation(() => new Promise(() => {}));
    api.getReportVersion.mockResolvedValue('v2');
    await act(async () => { vi.advanceTimersByTime(REPORT_VERSION_POLL_MS); });
    await flush();
    await flush();
    expect(api.getFullReport).toHaveBeenCalledTimes(2);
    api.getReportVersion.mockResolvedValue('v3');
    await act(async () => { vi.advanceTimersByTime(REPORT_VERSION_POLL_MS * 3); });
    await flush();
    expect(api.getFullReport).toHaveBeenCalledTimes(2);
  });

  it('a failing version check never rebuilds or breaks the report', async () => {
    const { result } = renderHook(() => useFullReport('irvine', '2026-10-27', 'viewer-version-fail'));
    await flush();
    api.getReportVersion.mockRejectedValue(new Error('404'));
    await act(async () => { vi.advanceTimersByTime(REPORT_VERSION_POLL_MS); });
    await flush();
    expect(api.getFullReport).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(null);
  });
});
