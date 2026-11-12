export const REQUIRED_COMBINED_INDICATORS = 4;
export const SIGNIFICANT_CHANGE_PCT = 25;

export interface CombinedScoreEntry {
  value: number;
  lowerIsBetter: boolean;
}

export type SignificantChangeEvent = 'significant_increase' | 'significant_decrease';

export function calculateCombinedScoreFromLogs(logs: CombinedScoreEntry[]): number | null {
  if (logs.length !== REQUIRED_COMBINED_INDICATORS) return null;

  return logs.reduce(
    (sum, log) => sum + (log.lowerIsBetter ? log.value : 200 - log.value),
    0,
  );
}

export function getSignificantChangeEvent(
  currentValue: number,
  previousValue: number,
  lowerIsBetter: boolean,
): SignificantChangeEvent | null {
  if (previousValue <= 0) return null;

  const percentChange = ((currentValue - previousValue) / previousValue) * 100;
  if (Math.abs(percentChange) < SIGNIFICANT_CHANGE_PCT) return null;

  if (percentChange > 0) {
    return lowerIsBetter ? 'significant_increase' : 'significant_decrease';
  }
  return lowerIsBetter ? 'significant_decrease' : 'significant_increase';
}

export function shouldCreateFirstReport(existingLogCount: number, entryIndex: number): boolean {
  return existingLogCount === 0 && entryIndex === 0;
}
