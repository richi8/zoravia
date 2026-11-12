# C03 · Content pack system — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C02

## Summary
The engine now loads all content from packs. A pack has a validated manifest (`id`, `version`, `dependsOn`), adds entries to namespaced registries (`core:xyz`), can override or patch entries of packs it depends on, and can register hooks. The loader sorts packs by dependency, validates every entry with Zod, and reports all problems at once in one readable `PackError`. The engine defines no content kinds itself — game code declares them with `defineRegistry`.

## What was built
- `src/engine/packs/ids.ts` — `NamespacedId` (branded), `makeId`, `parseId`, `isNamespacedId`, `resolveId` (bare name → own namespace), `namespacedIdSchema` for references.
- `src/engine/packs/version.ts` — `parseVersion`, `compareVersions`, `satisfies` (`*`, exact, `>=`, `^`).
- `src/engine/packs/pack.ts` — `manifestSchema`, `PackDefinition` (`manifest`, `content`, `overrides`, `patches`, `setup`), `definePack`.
- `src/engine/packs/registry.ts` — `defineRegistry(kind, schema)`, read-only `Registry<T>` (`get`, `require` with "did you mean", `has`, `ids`, `values`, `inNamespace`, `origin`, iterable).
- `src/engine/packs/hooks.ts` — `HookRegistry` of typed transform hooks (`HookSpec<Value, Context>`), ordered by priority then pack load order.
- `src/engine/packs/loader.ts` — `PackLoader(registries).load(packs)` → `LoadedContent` (`packs`, `hooks`, `registry(def)`).
- `src/engine/packs/errors.ts` — `PackError` with `issues[]` (`pack`, `path`, `message`) and a multi-line message.
- Fixtures: `tests/fixtures/packs/index.ts` (`base` pack + `remix` pack that depends on, overrides, patches, and hooks into `base`).
- Tests: `loader.test.ts` (28 incl. `parts.test.ts` for ids/version/hooks).

## Decisions
- **Decision:** Packs are TS modules using `definePack(...)`; content is `kind → localId → data` maps.
  - **Why:** map keys make ids unique by construction and give clean error paths (`content.species.emberfox.hp`). TS modules allow `setup` hooks; pure-data JSON packs fit the same shape later.
- **Decision:** Three ways to change content: `content` (add, own namespace only), `overrides` (replace whole entry), `patches` (shallow-merge fields, then re-validate).
  - **Why:** "add/override rules" from the plan; patches make small balance mods (price, power) tiny and robust to upstream changes.
  - **Alternatives considered:** deep merge — ambiguous for arrays (learnsets); deferred.
- **Decision:** You may only override/patch namespaces your pack depends on (directly or transitively).
  - **Why:** guarantees the target was loaded first; otherwise behaviour would depend on accidental pack order.
- **Decision:** Load order = depth-first topological sort, ties in input order.
  - **Why:** deterministic, and matches the order modders list packs.
- **Decision:** Collect all issues, throw once.
  - **Why:** modders fix everything in one pass instead of one error per reload.
- **Decision:** Entries are deep-frozen and carry their `id`; registry schemas must produce objects.
  - **Why:** content is shared immutable data (safe for the pure battle engine); `entry.id` is convenient everywhere.
- **Decision:** Hooks are synchronous value transforms, not events.
  - **Why:** covers both "modify" (damage, price) and "observe" (return value unchanged) cases, deterministic for battle code. Plain notifications can use `EventBus` from C02.
- **Decision:** Dependency ranges support only `*`, exact, `>=`, `^`. No `~`, no pre-release tags.
  - **Why:** enough for packs; avoids a semver dependency.

## Deviations from plan / design
None.

## Issues & known limitations
- Cross-references between entries (e.g. a species' learnset naming `core:tackle`) are only format-checked (`namespacedIdSchema`), not checked for existence. C12 should add a post-load reference check (follow-up).
- No way to *remove* an entry from another pack yet.
- Patches are shallow: patching a nested object replaces it whole.
- `npm audit` still shows the dev-only ESLint advisory from C01; Zod adds none.

## Verification
- `npm run check` — typecheck, lint, format, 80 tests: all pass.
- Done when:
  - Tests load 2 fixture packs where one overrides the other: ✅ (`base` + `remix`, passed out of order; override, patch, hook order, origins verified)
  - Invalid pack fails with a readable message: ✅ (exact message asserted: `[bad] content.creatures.glitch.hp: Invalid input: expected number, received string`; plus manifest, unknown kind, missing/mismatched dependency, cycle, duplicate, namespace and override-rule errors)

## Follow-ups
- C12: post-load reference validation (every `NamespacedId` field must exist in its target registry), possibly via a `ref(registry)` schema helper.
- Later: entry removal, JSON packs loaded from URLs (mod loader is a future/server item).

## Notes for the next chunk
- Usage: `const species = defineRegistry('species', schema); const content = new PackLoader([species]).load([corePack]); content.registry(species).require('core:emberfox')`.
- Entry types come from `z.output` of the schema, plus `id: NamespacedId`.
- Pass the *same* `RegistryDefinition` object to the loader and to `content.registry()`.
- Hook maps are declared by the code that exposes the extension point: `type Hooks = { 'battle:damage': HookSpec<number, Ctx> }`.
