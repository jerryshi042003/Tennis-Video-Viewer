// In-memory cache
const logoCache = new Map()
const CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

const readStoredCache = () => {
  try {
    const value = JSON.parse(localStorage.getItem('logoCache'))
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {}
  } catch {
    return {}
  }
}

export const getLogoFromCache = (teamName) => {
  // Check in-memory cache first
  const cachedLogo = logoCache.get(teamName)
  if (cachedLogo && Date.now() - cachedLogo.timestamp < CACHE_EXPIRY) {
    return cachedLogo.url
  }

  // Check localStorage
  const storedLogo = readStoredCache()[teamName]
  if (storedLogo && Date.now() - storedLogo.timestamp < CACHE_EXPIRY) {
    // Update in-memory cache
    logoCache.set(teamName, storedLogo)
    return storedLogo.url
  }

  return null
}

export const setLogoInCache = (teamName, logoUrl) => {
  const cacheEntry = {
    url: logoUrl,
    timestamp: Date.now()
  }

  // Update in-memory cache
  logoCache.set(teamName, cacheEntry)

  // Update localStorage
  const parsedCache = readStoredCache()
  parsedCache[teamName] = cacheEntry
  try {
    localStorage.setItem('logoCache', JSON.stringify(parsedCache))
  } catch {
    // Persistence is optional; the in-memory cache remains usable.
  }
}

export const clearLogoCache = () => {
  logoCache.clear()
  try {
    localStorage.removeItem('logoCache')
  } catch {
    // Storage can be unavailable in private or restricted browsers.
  }
}
