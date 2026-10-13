// `npm run dev`: the API server plus Vite's dev server with hot reload, in one terminal.
import { spawn } from 'node:child_process';

const run = (command) => spawn(command, { shell: true, stdio: 'inherit' });

const children = [
  run('node --disable-warning=ExperimentalWarning src/server.js'),
  run('npx vite'),
];
const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const c of children) c.on('exit', stop);
