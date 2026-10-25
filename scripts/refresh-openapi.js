// Refreshes the OpenAPI snapshot the contract tests read, from the live API.
import { writeFileSync } from 'node:fs';

const response = await fetch('https://api.stablevoy.com/v1/openapi.json');
if (!response.ok) throw new Error(`HTTP ${response.status}`);
writeFileSync(new URL('../test/fixtures/openapi.json', import.meta.url), await response.text());
console.log('test/fixtures/openapi.json refreshed; run npm test');
