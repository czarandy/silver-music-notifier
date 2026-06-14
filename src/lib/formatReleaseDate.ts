const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatReleaseDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  const [year, month, day] = value.split('-').map(Number);
  if (!year) {
    return value;
  }
  if (month && !day) {
    return `${monthNames[month - 1]} ${year}`;
  }
  if (!month || !day) {
    return value;
  }
  return `${day} ${monthNames[month - 1]} ${year}`;
}
