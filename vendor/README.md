# Deployment dependency snapshot

`inkra-react-0.15.0-candidate.tgz` is the built public `@inkra/react` package
currently used by the game, frozen so GitHub Pages reproduces the local component
appearance without requiring an unpublished npm release or a developer's path.

- Source: https://github.com/inkrajs/inkra (`packages/inkra`), local candidate 0.15.0.
- SHA-256: `de0c8e9c03929bbb49dc267ce5a64e8773a399b27b153fded1724d6033336239`.
- The archive includes the dependency's MIT license, third-party notices, and
  Xiaolai/Yozai font OFL notices. These apply to the dependency, not the game.
- Produced with `npm pack --ignore-scripts`; no game state or local configuration
  is included. Do not edit extracted files or maintain a fork here.

CI runs `node scripts/use-deploy-inkra.mjs` after `npm ci`. Normal local development
keeps its existing linked package; this script is an explicit deployment setup.
After the compatible components are published, remove this snapshot and use the
published package through the regular lockfile.

The game also applies a narrow Vite-time compatibility transform to this version's
`InventoryGrid`: touch dragging activates after 6px of movement rather than a
180ms hold. It does not change the snapshot or extracted package. The transform
checks the expected implementation and fails the build if it changes. Remove it
when the component exposes a public touch activation option.
