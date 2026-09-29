## 2024-07-07 - [Optimize N+1 queries in demand planning]
**Learning:** `GetDemandPlanningReport` had an N+1 query vulnerability because it iterated over inventory items and called `CalculateSalesVelocity`, which internally triggered a redundant database query to fetch the same stock value.
**Action:** Pass the already fetched inventory item's quantity as an optional parameter (`preFetchedStock`) down to `CalculateSalesVelocity.execute()` to prevent redundant lookups.
## 2024-05-24 - O(N^2) Lookup in Purchase Order / RMA / Audit receive flows
**Learning:** In the `ReceivePurchaseOrder`, `ReceiveRMA`, and `RecordAuditCount` flows, passing an array of received/counted items results in O(N^2) time complexity because the aggregate's methods (`receiveItems`, `receiveItem`, `recordCount`) perform a `.find()` on their internal `_items` array for each passed item. When dealing with hundreds or thousands of items, this creates a severe performance bottleneck.
**Action:** Implemented lazy-initialized `Map` structures inside the aggregate roots (`PurchaseOrder`, `RMA`, `InventoryAudit`) to cache item lookups. This transforms the inner lookup to O(1), improving batch processing times significantly.

## 2026-07-04 - [AuditProcessorService Optimize]
**Learning:** Found N+1 queries in AuditProcessorService.ts when fetching external accounting journal mappings inside a loop, and aggregating inventory models.
**Action:** Pre-fetched data using `groupBy` and `findMany` using `in` clause to do it in O(1) inside loop to resolve N+1 queries. Used Set for O(1) mapping verification inside the loop instead of multiple sequential `findUnique` operations.

## 2026-07-09 - [Optimize N+1 query in ReorderPolicyService evaluatePolicies]
**Learning:** Found an N+1 query where `this.poRepository.findAll()` was called inside a loop over `policies` during `evaluatePolicies`.
**Action:** When a method iterates over a set of items (like policies) and requires checking a global state (like all POs), fetch the global state once before the loop and use it within the loop to avoid N+1 database queries.
## 2025-02-12 - Batched save optimizations in `Promise.all` loops
**Learning:** In complex mapping logic inside `Promise.all` loops (e.g. `ReceiveRMA.ts`, `ReconcileInventoryAudit.ts`), performing individual `await repo.save(item)` within the mapping callback executes N database writes sequentially for a single array of items. Although the repository might support a `saveMany` operation, it can't be utilized when iterating and saving individually. Furthermore, when mapping concurrently with `Promise.all`, multiple array iterations could attempt to read/modify the exact same inventory item based on its variantId and locationId resulting in race conditions.
**Action:** When updating or creating records sequentially inside a `Promise.all` map over an array, use an in-memory cache to accumulate the changes (like a `Set` to prevent duplicated entities) or a `Map` mapping cache-keys. Afterwards, execute `saveMany(Array.from(set))` outside the promise block, dropping individual `await repo.save` calls. This optimizes database overhead replacing N queries with 1 batch operation and effectively eliminates concurrency-induced race conditions when manipulating stock totals for repetitive variants.

## 2026-07-09 - N+1 Query in DisassembleKit
**Learning:** Resolving an N+1 loop using a batched `findBySkus` method requires ensuring the interface officially requires the method. Optional typing (`?`) with runtime conditional checks (`if (this.repo.findBySkus)`) bypasses TypeScript strictness constraints but pollutes the domain logic with dirty fallbacks and Type casts (`as any`).
**Action:** When updating a usecase to eliminate an N+1 repository call, ensure the `IInventoryRepository` interface requires the batched method and remove the `Promise.all` fallback entirely for a cleaner, strictly typed resolution.

## 2024-07-13 - [Optimize N+1 query and Race Condition in ReceivePurchaseOrder]
**Learning:** In `ReceivePurchaseOrder.ts`, the loop `await Promise.all(dto.items.map(async (item) => {...}))` executed individual `receiveStock.execute(...)` which internally checked the database `this.inventoryRepository.findBySku` and performed individual `this.inventoryRepository.save(item)`. Not only does this produce N+1 queries when receiving POs with large numbers of distinct variants, but due to `Promise.all`, concurrent modifications to the same SKU across different PO items could trigger a concurrency exception because `save` relies on the optimistic locking version number.
**Action:** Batched fetched inventory items beforehand into a `Map` cache to avoid N+1 DB lookups. Removed `Promise.all` on item iteration, replacing it with a sequential loop processing in-memory items to avoid race conditions. Finally batched `saveMany` for all modified inventory entities, minimizing DB transactions.

## 2026-07-14 - Optimize N+1 Query in DisassembleKit and CostLayer Service
**Learning:** Found N+1 queries when calling `costLayerRepository.getActiveLayers` sequentially inside `Promise.all` loops (e.g., iterating through component variants in `DisassembleKit.ts` or `consumeLayersBatch` in `CostLayerService.ts`). Additionally, use cases were filled with conditional `Promise.all` fallback loops for batch methods like `saveMany` and `findBySkus`.
**Action:** Created `getActiveLayersBatch` in `ICostLayerRepository` and its implementations to resolve the exact N+1 loops. Made `saveMany` strictly mandatory across repositories (`IInventoryRepository` and `ICostLayerRepository`) to enforce performance-first architecture and eliminate the messy fallback queries and `as any` typecasts entirely.
## 2026-11-20 - [Optimize N+1 queries in Shopify GraphQL and DB loops in AuditProcessorService]
**Learning:** Found N+1 HTTP request issues to Shopify and N+1 DB aggregation calls inside a variant loop within `AuditProcessorService.runAudit`.
**Action:** Replaced sequential database aggregations inside the loop with a bulk `groupBy` before the loop. Replaced sequential Shopify GraphQL requests with a batched query utilizing dynamic GraphQL aliases (e.g. `var0: inventoryItems(...)`, `var1: inventoryItems(...)`) inside chunks of 50 to avoid rate limiting and excessive networking overhead. Always remember to add the `groupBy` mock inside test files handling mocked DB responses.

## 2026-11-20 - [Optimize N+1 query and Race Condition in ReceiveRMA]
**Learning:** Found N+1 queries when mapping \`dto.items\` concurrently with \`Promise.all\` in \`ReceiveRMA.ts\`. This executes N db lookups and individual \`save\` operations. The fallback logic on \`saveMany\` and \`findBySkus\` across the codebase makes the codebase unnecessarily defensive. However, completely ripping out those fallbacks and changing the interface creates large over-reaching changes across completely unrelated files (like \`DisassembleKit.ts\`, \`AssembleKit.ts\`, etc.) which significantly increases the risk of runtime errors or incomplete mock implementations breaking tests. It is safer to address the primary performance bottleneck directly in the affected use case and gracefully handle the fallback locally.
**Action:** Reverted the interface changes that forced \`saveMany\` to be mandatory. Kept the fallback logic inside \`ReceiveRMA.ts\` itself (\`if (this.inventoryRepository.saveMany)\`), but successfully transformed the \`Promise.all\` loop into a sequential \`for...of\` loop combined with a batched pre-fetch (\`findBySkus\`) and batched \`saveMany\`. This eliminates N+1 DB operations and race conditions without polluting unrelated files.

## 2026-11-20 - [Optimize N+1 query and Race Condition in ReceivePurchaseOrder]
**Learning:** Found N+1 queries when mapping `dto.items` concurrently with `Promise.all` in `ReceivePurchaseOrder.ts`. This executes N db lookups via `receiveStock.execute` and individual `save` operations, which can also trigger race conditions for identical SKUs.
**Action:** Transformed the `Promise.all` loop into a sequential `for...of` loop combined with a batched pre-fetch (`findBySkus`) into a `Map` and batched `saveMany`. Inlined the minimal physical stock addition logic from `ReceiveStock` to decouple the batched approach from single-item nested repository calls. This eliminates N+1 DB operations and race conditions without polluting unrelated files.

## 2026-11-20 - [Optimize N+1 query and Race Condition in ReconcileInventoryAudit]
**Learning:** Found N+1 queries when mapping `audit.items` concurrently with `Promise.all` in `ReconcileInventoryAudit.ts`. This executes N db lookups via individual `save` operations, which can trigger race conditions on identical SKUs.
**Action:** Transformed the `Promise.all` loop into a sequential `for...of` loop combined with a batched in-memory update process and batched `saveMany` for inventory items and cost layers. This eliminates N+1 DB operations and race conditions while preserving the fallback logic for interfaces not implementing `saveMany`.

## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks (`StartLine`/`EndLine`) for edits to `schema.prisma`, `index.ts`, `public/index.php`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.


## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks for edits to `schema.prisma`, `index.ts`, `public/index.php`, `db/schema.rb`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.

## Completeness & Verification Directives
- **Explicit Parameter & Contract Validation**: When creating or modifying API endpoints (Express, Fastify, Rails, Laravel), always implement explicit parameter and request body validation schemas (e.g. `z.string().uuid()`) to prevent unhandled 404/500 fallthroughs.
- **Database Indexing for Queries**: When addressing query bottlenecks or adding query lookup filters, always implement native database index migrations rather than loading collections into memory and performing array filtering (`.filter()`, `.select`).
- **Co-Occurring Dependency Auditing**: When bumping any dependency version, verify that other transitive dependencies do not carry high/critical security advisories (e.g. run `bundler-audit`, `npm audit`). Never introduce a version bump that breaks underlying framework APIs.
- **Self-Verification Before Commit**: Always run syntax checks (`bash -n` for shell scripts, `tsc --noEmit` for TypeScript, linter checks) and targeted test runners locally before opening or updating a PR.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.

## Assertiveness, Decisive PR Execution & Comparative Recommendations
- **Proactive & Decisive PR Submission**: Do NOT repeatedly pause to ask permission to open a pull request (e.g., avoid "Would you like me to open a PR for this?", "Can I submit the PR?", "Should I go ahead and create the PR?"). When an optimization, fix, or feature satisfies requirements, passes local test runners/linters, and preserves architectural invariants, proceed decisively to create and submit the Pull Request with a clear, structured summary and rationale.
- **Explicit Recommendations on Options**: When presenting multiple implementation strategies or architecture options (e.g., Option A vs. Option B), NEVER leave the choice open-ended or passive. Always make an explicit, reasoned recommendation (prefixed with `(Recommended)`) based on **overall technical effectiveness**:
  1. *Algorithmic & Complexity Gains*: Time and space complexity impact (O(N*M) -> O(N+M), reduction of nested scans).
  2. *Resource Overhead*: Heap allocations, memory pressure, and GC pause reduction.
  3. *Domain & Architecture Invariants*: Strict backward compatibility, contract stability, and prevention of regression risks.
  4. *Security & Reliability*: Input validation, cryptographic safety, and concurrency safety.
- **Lead with Recommended Path**: State clearly why the recommended solution delivers the highest net value and immediately execute or propose it as the primary course of action rather than asking open-ended questions.

## Scope Verification, Minimal Churn & CI Protection Directives
- **Scope Verification Before Variable Binding**: When adding interactive states or accessibility attributes (e.g. `disabled={loading}`, `aria-busy={loading}`, `isSubmitting`), NEVER assume a variable identifier exists. Always inspect component props, local state hooks (`useState`), or declaration scope first. If not defined, declare the state hook or reuse an existing scope variable. Never introduce TS2304 / TS2552 ("Cannot find name") compile errors.
- **Surgical Edits Only (No Whole-File Formatting)**: Never run whole-file code formatters (Prettier, Black, Pint, rustfmt) across unmodified lines. Changes must be strictly range-scoped and limited to the minimal AST block needed. Avoid noisy quote/whitespace churn that masks real logic changes and causes merge conflicts. Verify with `git diff -w` that non-functional churn is zero.
- **Zero Scratch File Commits**: Never stage or commit ad-hoc verification, patch, or debug scripts (`test.cjs`, `fix_*.cjs`, `fix_*.php`, `patch_*.py`, `patch_*.sh`, `scratch_*`). Execute checks via the project's native test commands (`npm test`, `pytest`, `phpunit`, etc.) and delete temporary scripts before creating git commits.
- **Never Weaken CI Workflows**: Do not modify `.github/workflows/**` to bypass failures (e.g. adding `|| true`, setting `continue-on-error: true`, or commenting out assertions). Always resolve the defect in the source code or test fixture.
- **Explicit Parameter & Variable Types**: In TypeScript files, avoid implicit `any` by always providing explicit types on functions, parameters, and arrow callbacks (e.g. `(id: string) => ...`). Verify zero type errors with `tsc --noEmit` before committing.

## 2026-09-29 - Surgical Optimization Edits and No Scratch Script Commits
**Learning:** Running whole-file formatters or regenerating entire components while performing performance optimizations introduces massive whitespace/formatting diffs (1,000+ lines), masking the real optimization, invalidating git blame, and causing painful merge conflicts with concurrent PRs. Additionally, committing scratch benchmark or patch scripts (`patch_*.py`, `test.cjs`) pollutes production repositories and triggers CI guardrail failures.
**Action:** Restrict all algorithmic and performance optimizations to strictly scoped replacement chunks. Diff size must reflect only the functional optimization. Always clean up temporary benchmark or patch scripts with `git rm -f` before committing.
