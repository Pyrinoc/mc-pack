# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"kubispack" is a Minecraft Bedrock Edition add-on: a behavior pack plus a resource pack, with TypeScript scripts using the `@minecraft/server` Script API. It was built from Mojang's TypeScript starter template, so build tooling comes from `@minecraft/core-build-tasks` via `just-scripts`. The project name (`kubispack`) and deploy target (`MINECRAFT_PRODUCT`) are read from `.env`.

## Commands

On Windows, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first if PowerShell blocks the npm scripts.

- `npm run build`: runs `tsc` (type check, output in `lib/`), then esbuild bundles `scripts/main.ts` into `dist/scripts/main.js`.
- `npm run lint`: ESLint with `eslint-plugin-minecraft-linting`. Add `-- --fix` to auto-fix.
- `npm run local-deploy -- --watch`: builds and copies both packs and the scripts into the local Minecraft dev folders, then rebuilds on any change to `.ts`, `.json`, `.lang` or `.png` files.
- `npm run mcaddon`: writes a shareable `dist/packages/kubispack.mcaddon`. The `:production` variants strip statements labelled `dev:`.

There are no tests. To debug, use the VS Code launch config "Debug with Minecraft" (attaches on port 19144 and uses the source maps in `dist/debug`).

## Architecture

- **Scripts** (`scripts/`): `main.ts` is the only bundle entry point. Everything is wired up there:
  - world/system event subscriptions
  - the `system.beforeEvents.startup` hook, which registers custom commands (`TPCommand.setup`, `MazeCmd.setup`) and custom item/block components
  - a self-rescheduling `mainTick` loop that auto-repairs players' gear

  Feature modules export functions that `main.ts` calls; they don't subscribe to events themselves. The two `@minecraft/*` runtime modules are marked external in the bundle and provided by the game.
- **JSON ↔ script linkage:** item and block JSON in `behavior_packs/kubispack/` refers to script behavior through custom components (for example `"kubi:teleport_function": {}` in `items/teleport_wand.json`). Each one must be registered under the exact same name in `main.ts` via `itemComponentRegistry` or `blockComponentRegistry`. If you add a scripted block or item, change both sides.
- **Namespace:** every custom identifier uses the `kubi:` prefix, including items, blocks, entities, particles, commands and dynamic property keys.
- **Persistence:** state is kept in dynamic properties on the world or on players, for example teleport points (`kubi:tpName-N`/`kubi:tpLocation-N`), auto-repair toggles (`kubi:auto_repair_*`) and last death location. There is no other storage.
- **Letter blocks:** `blocks/{pink,white}_letters/` and `recipes/{pink,white}_letters/` hold 26 near-identical files per color. Edits to one usually need to be applied to all 52 blocks or 52 recipes.

## Versioning conventions

- **`format_version`:** keep block, item, recipe, entity and item_catalog files on the current Bedrock release's version (1.26.50 as of Oct 2026). Use Mojang's `bedrock-samples` repo (`version.json` and the vanilla packs) and the Microsoft Learn creator docs to check what's current. Resource-pack animation (1.8.0), animation controller, render controller, client entity and particle files (1.10.0) correctly use older versions.
- **Manifests:** the `@minecraft/server` / `@minecraft/server-ui` versions in `behavior_packs/kubispack/manifest.json` must match the APIs the scripts use (npm versions are in `package.json`). Bump the pack `version` arrays together in both manifests.
- **Text strings:** user-facing names live in `resource_packs/kubispack/texts/en_US.lang`.
