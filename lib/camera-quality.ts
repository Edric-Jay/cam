/** Ask for native stream dimensions. Reported capabilities are device-specific. */
export async function requestMaximumQuality(track: MediaStreamTrack): Promise<void> {
  const caps = track.getCapabilities?.() as (MediaTrackCapabilities & {resizeMode?: string[]}) | undefined;
  if (!caps?.width?.max || !caps?.height?.max) return;
  const constraints: MediaTrackConstraints = {
    width: { ideal: caps.width.max },
    height: { ideal: caps.height.max },
  };
  try {
    await track.applyConstraints({ ...constraints, ...(caps.resizeMode?.includes('none') ? { resizeMode: 'none' } : {}) });
  } catch {
    // Some cameras advertise combinations they cannot deliver together.
    // Retain the live stream if even the unconstrained resize request fails.
    try { await track.applyConstraints(constraints); } catch { /* Keep existing stream. */ }
  }
}
