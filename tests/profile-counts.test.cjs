const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { transformSync } = require('@babel/core')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

// Compile the actual JSX modules; substitute only CSS, images and Firebase I/O.
function loadSource(file, mocks = {}) {
  const { code } = transformSync(
    readFileSync(join(__dirname, '..', file), 'utf8'),
    {
      babelrc: false,
      configFile: false,
      presets: [
        ['@babel/preset-env', { targets: { node: '18' }, modules: 'commonjs' }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }
  )
  const module = { exports: {} }
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name.endsWith('.css')) return {}
    return require(name)
  }
  new Function('require', 'module', 'exports', code)(
    localRequire,
    module,
    module.exports
  )
  return module.exports.default
}

const StatBox = loadSource('app/components/StatBox.js')
const Header = loadSource('app/components/PlayerProfileHeader.js', {
  '@/app/components/StatBox': StatBox,
  '@/public/images/defaultPhotoBig.png': { src: '/default.png' },
  'next/image': () => null
})

async function profileWithStats(
  stats,
  firstName = 'Ada',
  lastName = 'Zero',
  playerId = 'ada-zero'
) {
  const Page = loadSource('app/profile/[playerId]/page.js', {
    'firebase/firestore': {
      collection: () => null,
      getDocs: async () => ({
        docs: [
          {
            data: () => ({
              name: 'University of California, Los Angeles (M)',
              players: [{ firstName, lastName, stats }]
            })
          }
        ]
      })
    },
    '@/app/services/initializeFirebase': { db: null },
    'next/navigation': {
      notFound() {
        throw new Error('Unexpected missing player')
      }
    },
    '@/app/components/PlayerProfile': () => null
  })
  const element = await Page({
    params: Promise.resolve({ playerId })
  })
  return element.props.playerData
}

for (const [label, stats, expected, display] of [
  ['known zero wins', { overallWins: 0, singleWins: 0, doubleWins: 0 }, 0, '0'],
  ['missing win totals', undefined, null, '—']
]) {
  test(`${label} stay distinct from unknown or fictional counts`, async () => {
    const data = await profileWithStats(stats)
    for (const key of ['overallWins', 'singleWins', 'doubleWins'])
      assert.equal(data[key], expected)
    const html = renderToStaticMarkup(
      React.createElement(Header, { playerData: data })
    )
    for (const name of ['Overall Wins', 'Single Wins', 'Double Wins']) {
      assert.ok(
        html.includes(`<p>${name}</p><p>${display}</p>`),
        `wrong count for ${name}`
      )
    }
  })
}

const RosterTile = loadSource('app/components/RosterTile.js', {
  'next/link': ({ href, children }) =>
    React.createElement('a', { href }, children),
  'next/image': () => null,
  '@/public/images/defaultPhotoBig.png': { src: '/default.png' }
})

for (const [firstName, lastName, slug] of [
  ['Emon', 'van Loben Sels', 'emon-van-loben-sels'],
  ['Mary Ann', 'Smith', 'mary-ann-smith'],
  ['Jean-Luc', 'Martin', 'jean-luc-martin'],
  ['Álvaro', 'García Márquez', 'alvaro-garcia-marquez'],
  ['Spencer', 'Johnson', 'spencer-johnson'],
  ['Hodan', "O'Neill", 'hodan-oneill']
]) {
  test(`roster link resolves the full profile name: ${firstName} ${lastName}`, async () => {
    const html = renderToStaticMarkup(
      React.createElement(RosterTile, { firstName, lastName })
    )
    const href = html.match(/href="([^"]+)"/)[1]
    assert.equal(href, `/profile/${slug}`)
    const data = await profileWithStats(
      undefined,
      firstName,
      lastName,
      href.slice('/profile/'.length)
    )
    assert.equal(data.name, `${firstName} ${lastName}`)
  })
}

test('a trailing name fragment does not resolve to a different full slug', async () => {
  await assert.rejects(
    profileWithStats(undefined, 'Ada', 'Zero', 'ada-zero-extra'),
    /Unexpected missing player/
  )
})
