// Shared relative-time formatter — was previously duplicated only inside
// ActivityItem.jsx; pulled out so Notifications can use the exact same
// "2h ago" / "3d ago" logic instead of a second, possibly-drifting copy.
export function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
