import {defineConfig} from 'vitest/config';
// Historical audit reproductions in docs assert old defects; preserve them as evidence.
export default defineConfig({test:{include:['tests/**/*.test.ts','tests/**/*.test.mjs']}});
