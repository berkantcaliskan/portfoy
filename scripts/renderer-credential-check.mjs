import { createHash } from 'node:crypto'

// Full SHA-256 of the exact binary resources verified against the sanitized template
// and the upstream distributions pinned by packages/contract-engine/package-lock.json.
const publicResources = new Map([
  ['App', new Set(['f90925616d58eb3d7fdbc4043fbb8d34e001041f6af58ca5ddef7a66794c6b94'])],
  ['canvas', new Set(['594c2d731ff09e157dc128d687396bec21210cc22863fff65be343b6564eea19',
    '0e7d1502605ae338a48e6c35b33618ceada14288c3fc1bea558f1aeb5bfde3fd'])],
  ['pdf', new Set(['285359bafcd16062b062ef3c8cedaa9268c284dd8602fd246e95d80785076cb2',
    '90b5109576f56abbea63883b3b33691699c7acfa35ec9a92ef04eaf398f1bd4d'])],
  ['reader', new Set(['1e74837c53b61f435eaea4818e8150ea09675a4d0044eee6abef5069bd8b784e'])]
])

export function containsCredential(filename, text) {
  if (/(?:gh[pousr]_|github_pat_|sb_secret_)[A-Za-z0-9_-]{20,}/.test(text)) return true
  const potentialToken = /EAA[A-Za-z0-9]{40,}/
  if (!potentialToken.test(text)) return false
  const chunk = /^assets\/(App|canvas|pdf|reader)-[\w-]+\.js$/.exec(filename)?.[1]
  const known = publicResources.get(chunk)
  if (!known) return true

  // Examine the entire literal. New assets, appended text and tokens elsewhere
  // still fail the release check, even if the same chunk includes a known asset.
  const checked = text.replace(/(["'`])(?:data:[\w.+/-]+;base64,)?([A-Za-z0-9+/]{40,}={0,2})\1/g,
    (literal, _quote, encoded) => {
      if (!potentialToken.test(encoded)) return literal
      const bytes = Buffer.from(encoded,'base64')
      if (bytes.toString('base64') !== encoded) return literal
      return known.has(createHash('sha256').update(bytes).digest('hex')) ? '""' : literal
    })
  return potentialToken.test(checked)
}
