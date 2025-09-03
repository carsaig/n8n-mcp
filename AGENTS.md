# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (e.g., `src/mcp/`, `src/services/`, `src/utils/`, `src/n8n/`). Entry points: `src/index.ts`, `src/mcp/index.ts`.
- Tests: `tests/` with `unit/`, `integration/`, helpers under `tests/helpers`, fixtures under `tests/fixtures`.
- Scripts: `scripts/` (dev/test/release utilities) and `src/scripts/` (TypeScript dev tools).
- Build output: `dist/` (generated). Config in `tsconfig*.json`. Data assets in `data/`.

## Build, Test, and Development Commands
- `npm run build`: Compile TypeScript → `dist/` using `tsconfig.build.json`.
- `npm start`: Start MCP (stdio). Binary: `n8n-mcp` (from `dist/mcp/index.js`).
- `npm run start:http` / `start:http:fixed`: Run HTTP server (`MCP_MODE=http`), fixed URL mode.
- `npm run start:n8n`: Launch with n8n integration (`N8N_MODE=true`).
- `npm run dev`: Build + rebuild extracted artifacts + validate.
- `npm run dev:http`: Rebuild on change and serve over HTTP (via `nodemon`).
- `npm test`: Run Vitest. Variants: `test:unit`, `test:integration`, `test:coverage`, `test:watch`, `test:ui`.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Paths: `@/*` → `src/*`, `@tests/*` → `tests/*`.
- Prefer 2‑space indentation, descriptive names (`kebab-case` files, `camelCase` vars/functions, `PascalCase` types/classes).
- Type-first: no `any`; honor `tsconfig` strictness. Run `npm run typecheck`.
- Formatting: follow existing patterns; keep imports sorted and minimal.

## Testing Guidelines
- Framework: Vitest. Name tests `*.test.ts` close to feature or under `tests/{unit,integration}`.
- Coverage: `npm run test:coverage`. Add focused tests for new logic and edge cases.
- Integration: use fixtures in `tests/fixtures` and helpers in `tests/helpers`.

## Commit & Pull Request Guidelines
- Commits: Conventional style (e.g., `feat:`, `fix:`, `chore:`, `test:`). Keep changes scoped.
- PRs: Include summary, rationale, testing steps, linked issues, and screenshots/logs if relevant. Ensure `npm run build` and `npm test` pass.

## Security & Configuration Tips
- Secrets via env files (`.env.example`, `.env.n8n.example`). Never commit real secrets.
- Useful envs: `MCP_MODE=http`, `N8N_MODE=true`, `USE_FIXED_HTTP=true`.
- Docker: reference `docker-compose.*.yml` for local/CI setups.
