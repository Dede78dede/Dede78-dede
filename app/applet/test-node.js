const { spawn } = require('child_process');
const child = spawn('node', ['server.ts']);
child.stdout.on('data', (data) => console.log(`stdout: ${data}`));
child.stderr.on('data', (data) => console.error(`stderr: ${data}`));
child.on('close', (code) => console.log(`child process exited with code ${code}`));
setTimeout(() => child.kill(), 2000);
