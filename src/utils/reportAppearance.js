// Preserve report intervals while allowing both dashboard themes to style the badges.
export function getDaysSinceStyle(days) {
  const category =
    days == null
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
    label: days == null ? 'New' : `${days}d`,
  };
}
