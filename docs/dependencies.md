### Dependency notes

- Keep only Radix packages that are actually imported (`dialog`, `tooltip`, `slot`).
- `firebase-admin`, `genkit`, `@genkit-ai/googleai` → server-only.
- `dotenv` moved to `devDependencies` since Next auto-loads `.env*`.
- Removed `@types/uuid` (built into `uuid@9`).
