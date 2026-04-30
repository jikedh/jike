export const POINTS_FEATURE_ENABLED = true;

export const POINTS_DISABLED_BALANCE = Number.MAX_SAFE_INTEGER;

export const normalizeRequiredPoints = (points?: number) => {
  if (!POINTS_FEATURE_ENABLED) {
    return 0;
  }

  const normalized = Number(points);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return 0;
  }

  return normalized;
};
