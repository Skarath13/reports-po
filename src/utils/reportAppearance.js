// Preserve report intervals while allowing both dashboard themes to style the badges.
export function getDaysSinceStyle(days, lookupStatus) {
  const validDays = (typeof days === 'number' && Number.isFinite(days)) ||
    (typeof days === 'string' && days.trim() !== '' && Number.isFinite(Number(days)));
  const hasHistory = validDays &&
    (lookupStatus == null || lookupStatus === 'confirmed-history');
  const confirmedNew = days == null && lookupStatus === 'confirmed-new';
  const category =
    !hasHistory
      ? 'new'
      : days <= 6
        ? 'recent'
        : days <= 14
          ? 'fortnight'
          : days <= 28
            ? 'month'
            : days <= 60
              ? 'two-months'
              : 'older';
  return {
    bg: `var(--days-${category}-bg)`,
    text: `var(--days-${category}-text)`,
    label: hasHistory ? `${days}d` : confirmedNew ? 'New' : 'Unknown',
  };
}
