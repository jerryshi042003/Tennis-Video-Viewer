const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const source = readFileSync(
  join(__dirname, '../app/services/logoCache.js'),
  'utf8'
)
let moduleId = 0
const loadCache = () =>
  import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${moduleId++}`
  )

function useStorage(t, descriptor) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    ...descriptor
  })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  })
}

test('blocked storage still permits in-memory logos and clearing', async (t) => {
  useStorage(t, {
    get() {
      throw new Error('storage blocked')
    }
  })
  const cache = await loadCache()
  assert.equal(cache.getLogoFromCache('Alpha'), null)
  cache.setLogoInCache('Alpha', '/alpha.png')
  assert.equal(cache.getLogoFromCache('Alpha'), '/alpha.png')
  cache.clearLogoCache()
  assert.equal(cache.getLogoFromCache('Alpha'), null)
})

test('corrupt persisted data is replaced without breaking the cache', async (t) => {
  let value = 'not valid JSON'
  useStorage(t, {
    value: {
      getItem: () => value,
      setItem: (_, next) => {
        value = next
      },
      removeItem: () => {
        value = null
      }
    }
  })
  const cache = await loadCache()
  assert.equal(cache.getLogoFromCache('Alpha'), null)
  cache.setLogoInCache('Alpha', '/alpha.png')
  assert.equal(JSON.parse(value).Alpha.url, '/alpha.png')
  cache.clearLogoCache()
  assert.equal(value, null)
})

test('expired persisted logos remain cache misses', async (t) => {
  useStorage(t, {
    value: {
      getItem: () =>
        JSON.stringify({ Alpha: { url: '/old.png', timestamp: 0 } })
    }
  })
  const cache = await loadCache()
  assert.equal(cache.getLogoFromCache('Alpha'), null)
})
