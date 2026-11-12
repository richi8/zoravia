# Zoravia — instructions for AI sessions

Browser monster-collecting RPG in TypeScript. The creatures are called **Zorlings**.

## Read first
1. `DESIGN.md` — what the game is (source of truth for rules and numbers).
2. `IMPLEMENTATION_PLAN.md` — chunks, order, and "Done when" criteria.
3. `PROGRESS.md` — what is done.
4. `logs/` — logs of the chunks your chunk depends on.

## Rules
- Work on **one chunk per session**, only within its scope. Out-of-scope ideas go in the log's "Follow-ups".
- Do not start a chunk whose dependencies are not ✅, and do not pass a 🚦 gate without the user.
- All graphics and audio are generated in code — no external image/audio assets.
- The engine holds no game content; content lives in `packs/`.
- Battle logic stays pure and deterministic (seeded RNG, no rendering imports).
- The game must stay fully playable by keyboard alone.
- Run `npm run check` before finishing.
- When done: write `logs/CXX-<slug>.md` from `logs/TEMPLATE.md` and update `PROGRESS.md`.
- If a design rule must change, update `DESIGN.md` and explain why in the log.
- Commit each finished chunk as its own commit, including its log and the `PROGRESS.md` update. Message format: `CXX: <chunk name>` with a short summary in the body. Do not commit a chunk that fails `npm run check`.
