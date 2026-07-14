---
name: Porting Next.js crypto-wallet apps to Vite
description: Fixes needed when porting a Next.js app using web3/crypto libs (ethers, @solana/web3.js, bip32, bs58) into a pnpm-workspace Vite artifact.
---

When porting a Next.js app that uses Node-oriented crypto/web3 libraries into a Vite artifact in this monorepo, expect these specific issues:

1. **Buffer/global polyfill required.** Libraries like `ethers`, `@solana/web3.js`, `ed25519-hd-key`, `bs58` reference Node's `Buffer`/`global` even when "browser-compatible". A plain alias (`resolve.alias: { buffer: 'buffer' }`) does NOT work — Vite auto-externalizes the bare specifier `buffer` because it matches the Node built-in name, regardless of alias. Use `vite-plugin-node-polyfills` with `nodePolyfills({ include: ['buffer'] })` instead, and clear `node_modules/.vite` cache after adding it (alias changes don't reliably invalidate the dep-optimization cache).

2. **postcss.config.js / tailwind.config.js must be `.cjs`** if the package.json has `"type": "module"` and the config still uses `module.exports` (common for Tailwind v3 configs copied from Next.js backups). Otherwise Vite throws `module is not defined in ES module scope`.

3. **tsconfig needs `"allowJs": true, "checkJs": false`** when porting a mix of `.jsx`/`.js` files into a TypeScript Vite scaffold (e.g. shadcn UI components ported as `.jsx` instead of the scaffold's `.tsx` originals) — otherwise `tsc` throws `TS7016: Could not find a declaration file` for every cross-import between `.tsx` and the ported `.jsx`/`.js` files.

4. Delete any scaffold-provided shadcn/ui components that reference the ported `.jsx` primitives via `React.ComponentProps<typeof X>` generics (e.g. newer additions like `button-group.tsx`, `field.tsx`, `input-group.tsx`, `item.tsx`) if they aren't used by the ported app — since the `.jsx` primitives lack TS generics, these fail with `TS2339`/`TS2322` prop-type errors that have no clean fix short of rewriting them in TS too.

**Why:** these are non-obvious, repeatable failure modes specific to the Next.js→Vite + web3-lib combination in this monorepo's scaffold; none are discoverable by reading a single file in isolation.
