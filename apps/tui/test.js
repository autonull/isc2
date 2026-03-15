import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure dependencies are installed
const child = spawn('npx', ['tsx', path.join(__dirname, 'src', 'test-runner.ts')], {
  stdio: 'inherit',
  env: { ...process.env, FORCE_COLOR: '1' }
});

child.on('close', (code) => {
  process.exit(code || 0);
});
