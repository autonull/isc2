/* eslint-disable */
import { spawn } from 'child_process';

async function testMcp() {
  console.log('Testing ISC MCP server...');

  const child = spawn('npx', ['tsx', 'src/index.ts', 'mcp'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const sendRequest = (request: any) => {
    const json = JSON.stringify(request) + '\n';
    console.log('[STDIN] Sending:', json.trim());
    child.stdin.write(json);
  };

  return new Promise<void>((resolve, reject) => {
    let buffer = '';

    const handleData = (data: Buffer) => {
      const dataStr = data.toString();

      // Stdout should ONLY contain the MCP protocol (JSON-RPC)
      if (dataStr.includes('jsonrpc')) {
        buffer += dataStr;
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          try {
            const response = JSON.parse(line);
            console.log('[JSON] Received ID:', response.id);

            if (response.id === 1) {
              sendRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {}
              });
            } else if (response.id === 2) {
              console.log('✓ Successfully listed tools');
              sendRequest({
                jsonrpc: '2.0',
                id: 3,
                method: 'resources/list',
                params: {}
              });
            } else if (response.id === 3) {
              console.log('✓ Successfully listed resources');
              sendRequest({
                jsonrpc: '2.0',
                id: 4,
                method: 'prompts/list',
                params: {}
              });
            } else if (response.id === 4) {
              console.log('✓ Successfully listed prompts');
              child.kill();
              resolve();
            }
          } catch (e) {
            // Might be a partial line or non-JSON if redirection failed
            console.error('Failed to parse JSON from stdout:', line);
          }
        }
      }
    };

    child.stdout.on('data', handleData);

    child.stderr.on('data', (data) => {
      const str = data.toString();
      process.stdout.write(`[STDERR] ${str}`);

      if (str.includes('MCP server connected to transport')) {
          sendRequest({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'test-client', version: '1.0.0' }
            }
          });
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Exit code ${code}`));
      }
    });

    setTimeout(() => {
      child.kill();
      reject(new Error('Timeout waiting for MCP response'));
    }, 30000);
  });
}

testMcp().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
