const STORAGE_KEY = 'openhw_guided_hexes_v1'

export function getGuidedHex(projectSlug) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const map = JSON.parse(raw)
    return map[projectSlug] || null
  } catch {
    return null
  }
}

export function setGuidedHex(projectSlug, hexData) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '{}'
    const map = JSON.parse(raw)
    map[projectSlug] = hexData
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch (e) {
    console.warn('[GuidedHex] Failed to store hex:', e)
  }
}
