// The intervals preserve the existing report categories; colors suit a dark canvas.
export function getDaysSinceStyle(days) {
  if (days == null) return { bg: '#202735', text: '#b6cafa', label: 'New' };
  if (days <= 6) return { bg: '#30273e', text: '#d0b5f3', label: `${days}d` };
  if (days <= 14) return { bg: '#1b3027', text: '#9dd4b5', label: `${days}d` };
  if (days <= 28) return { bg: '#332e20', text: '#e5ce91', label: `${days}d` };
  if (days <= 60) return { bg: '#36291f', text: '#e9b98b', label: `${days}d` };
  return { bg: '#372427', text: '#efa7ae', label: `${days}d` };
}
