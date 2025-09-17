#!/usr/bin/env node

/**
 * Test the actual MCP protocol communication to identify where the error occurs
 */

const { spawn } = require('child_process');
const path = require('path');

async function testMCPProtocol() {
  console.log('🧪 Testing MCP Protocol Communication...\n');

  return new Promise((resolve, reject) => {
    // Start MCP server in stdio mode
    const serverPath = path.join(__dirname, 'dist', 'mcp', 'index.js');
    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, MCP_MODE: 'stdio' }
    });

    let stdout = '';
    let stderr = '';
    let responses = [];

    server.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      
      // Parse JSON responses
      const lines = chunk.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          responses.push(response);
          console.log('📥 Received response:', JSON.stringify(response, null, 2));
        } catch (e) {
          // Not JSON, ignore
        }
      }
    });

    server.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    server.on('close', (code) => {
      console.log(`\n🔚 Server closed with code ${code}`);
      
      if (stderr) {
        console.log('❌ Server stderr:', stderr);
      }
      
      // Analyze responses
      const initResponse = responses.find(r => r.id === 1);
      const toolResponse = responses.find(r => r.id === 2);
      
      if (initResponse) {
        console.log('✅ Initialize response received');
      } else {
        console.log('❌ No initialize response');
      }
      
      if (toolResponse) {
        console.log('✅ Tool response received');
        if (toolResponse.error) {
          console.log('❌ Tool response contains error:', toolResponse.error);
          resolve(false);
        } else if (toolResponse.result) {
          console.log('✅ Tool response contains result');
          console.log('📊 Result keys:', Object.keys(toolResponse.result));

          if (toolResponse.result.structuredContent) {
            console.log('✅ structuredContent is present in result');
            console.log('📊 structuredContent type:', typeof toolResponse.result.structuredContent);
            console.log('📊 structuredContent.valid:', toolResponse.result.structuredContent.valid);
            console.log('📊 structuredContent.summary:', toolResponse.result.structuredContent.summary);
            resolve(true);
          } else {
            console.log('❌ structuredContent is missing from result');
            console.log('📊 Available result fields:', Object.keys(toolResponse.result));
            resolve(false);
          }
        } else {
          console.log('❌ Tool response has no result or error');
          resolve(false);
        }
      } else {
        console.log('❌ No tool response received');
        resolve(false);
      }
    });

    server.on('error', (err) => {
      console.error('❌ Server error:', err);
      reject(err);
    });

    // Send initialize request
    setTimeout(() => {
      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0"
          }
        }
      };
      
      console.log('📤 Sending initialize request...');
      server.stdin.write(JSON.stringify(initRequest) + '\n');
    }, 100);

    // Send tool request
    setTimeout(() => {
      const toolRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "validate_workflow",
          arguments: {
            workflow: {
              nodes: [
                {
                  id: "1",
                  name: "Webhook",
                  type: "n8n-nodes-base.webhook",
                  typeVersion: 1,
                  position: [0, 0],
                  parameters: {
                    httpMethod: "POST",
                    path: "test-webhook"
                  }
                },
                {
                  id: "2",
                  name: "Set",
                  type: "n8n-nodes-base.set",
                  typeVersion: 1,
                  position: [200, 0],
                  parameters: {}
                }
              ],
              connections: {
                Webhook: {
                  main: [[{
                    node: "Set",
                    type: "main",
                    index: 0
                  }]]
                }
              },
              settings: {
                executionOrder: "v1"
              }
            }
          }
        }
      };
      
      console.log('📤 Sending validate_workflow request...');
      server.stdin.write(JSON.stringify(toolRequest) + '\n');
    }, 500);

    // Close stdin after requests
    setTimeout(() => {
      console.log('📤 Closing server stdin...');
      server.stdin.end();
    }, 1000);

    // Timeout after 5 seconds, but only if we haven't received both responses
    setTimeout(() => {
      if (responses.length >= 2) {
        console.log('✅ Both responses received, closing server...');
        server.kill();
      } else {
        console.log('⏰ Test timeout, killing server...');
        server.kill();
        resolve(false);
      }
    }, 5000);
  });
}

// Run the test
testMCPProtocol()
  .then((success) => {
    console.log('\n🎯 MCP Protocol Test Result:', success ? 'PASSED ✅' : 'FAILED ❌');
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 MCP Protocol Test Error:', error);
    process.exit(1);
  });
