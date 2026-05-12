export function formatDateTime(rawValue) {
  if (!rawValue) return 'No date'
  const parsed = new Date(rawValue)
  if (Number.isNaN(parsed.getTime())) return 'Invalid date'

  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function getAvatarLetters(name, fallback = 'S') {
  if (!name) return fallback
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function normalizeJoinCode(rawCode) {
  return (rawCode || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8)
}

export function assignmentStatus(assignment) {
  if (!assignment?.dueDate) {
    return { key: 'nodue', label: 'No due date' }
  }
  const dueAt = new Date(assignment.dueDate).getTime()
  if (Number.isNaN(dueAt)) {
    return { key: 'invalid', label: 'Invalid due date' }
  }
  return Date.now() > dueAt
    ? { key: 'closed', label: 'Closed' }
    : { key: 'open', label: 'Open' }
}
