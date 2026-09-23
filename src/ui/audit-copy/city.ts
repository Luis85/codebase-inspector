// Part 6 Y1–Y2: the city's cancelling state. Re-exported by inspector-copy.ts.

/** Y1: StatusBanner's copy while a scan is cancelling; over a snapshot it also says that
 *  snapshot stays available. Y2 (ruling R9): AnnouncementRegion announces these same words. */
export const CANCELLING_BANNER = (hasSnapshot: boolean): string =>
  (hasSnapshot ? 'Cancelling the scan… The current snapshot stays available.' : 'Cancelling the scan…');
