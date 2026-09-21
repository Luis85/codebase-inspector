// E12: the one "nice" axis maximum shared by the Hotspots scatter and BarChart: at least
// 10, rounded up to the next multiple of 10.
export const niceMax = (v: number): number => Math.max(10, Math.ceil(v / 10) * 10);
