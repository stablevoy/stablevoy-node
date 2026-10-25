// Checks the built package the way users load it: import from an ES module and require from CommonJS.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const dir = mkdtempSync(join(tmpdir(), 'stablevoy-smoke-'));
try {
  mkdirSync(join(dir, 'node_modules'));
  symlinkSync(process.cwd(), join(dir, 'node_modules', 'stablevoy'), 'dir');
  const check = "const s = m.Stablevoy.create({ apiKey: 'sk_test_x' }); if (typeof s.invoices.create !== 'function' || typeof m.WebhookVerifier !== 'function') throw new Error('exports missing'); console.log(kind, 'ok', m.VERSION);";
  execFileSync(process.execPath, ['--input-type=module', '-e', `import * as m from 'stablevoy'; const kind = 'import'; ${check}`], { cwd: dir, stdio: 'inherit' });
  execFileSync(process.execPath, ['--input-type=commonjs', '-e', `const m = require('stablevoy'); const kind = 'require'; ${check}`], { cwd: dir, stdio: 'inherit' });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
