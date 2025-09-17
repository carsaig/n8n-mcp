#!/usr/bin/env node

/**
 * Test script to verify the MCP validate_workflow fix
 * This simulates a real MCP client request to test the structuredContent fix
 */

const { spawn } = require('child_process');
const path = require('path');

// Test workflow data (same as user provided)
const testWorkflow = {
  "createdAt": "2025-09-15T16:48:42.239Z",
  "updatedAt": "2025-09-15T16:53:02.568Z",
  "id": "IxYGANvs39qLbj47",
  "name": "Updated Webhook Test Workflow",
  "active": false,
  "isArchived": false,
  "nodes": [
    {
      "id": "1",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [0, 0],
      "parameters": {
        "httpMethod": "POST",
        "path": "test-webhook",
        "responseMode": "lastNode",
        "responseData": "allEntries",
        "onError": "continueRegularOutput",
        "alwaysOutputData": true
      }
    },
    {
      "id": "2",
      "name": "Set",
      "type": "n8n-nodes-base.set",
      "typeVersion": 1,
      "position": [200, 0],
      "parameters": {}
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Set",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all",
    "saveManualExecutions": true,
    "saveExecutionProgress": true
  },
  "staticData": null,
  "meta": null,
  "pinData": null,
  "versionId": "4c53dfe0-ed06-4093-98e6-18781bae2da4",
  "triggerCount": 0
};

async function testMCPServer() {
  console.log('🧪 Testing MCP validate_workflow fix...\n');
  
  // Start MCP server in stdio mode
  const serverPath = path.join(__dirname, 'dist', 'mcp', 'index.js');
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'test', MCP_MODE: 'stdio' }
  });

  let responseData = '';
  let errorData = '';

  server.stdout.on('data', (data) => {
    responseData += data.toString();
  });

  server.stderr.on('data', (data) => {
    errorData += data.toString();
  });

  // MCP initialize request
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

  // MCP call_tool request for validate_workflow
  const toolRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "validate_workflow",
      arguments: {
        workflow: testWorkflow
      }
    }
  };

  return new Promise((resolve, reject) => {
    let requestsSent = 0;
    
    server.on('close', (code) => {
      console.log(`Server exited with code ${code}`);
      
      if (errorData) {
        console.log('❌ Server stderr:', errorData);
      }
      
      if (responseData) {
        console.log('📤 Server responses:');
        console.log(responseData);
        
        // Check if we got a proper response without the MCP error
        if (responseData.includes('MCP error -32600')) {
          console.log('\n❌ FAILED: Still getting MCP error -32600');
          resolve(false);
        } else if (responseData.includes('structuredContent')) {
          console.log('\n✅ SUCCESS: Response includes structuredContent');
          resolve(true);
        } else if (responseData.includes('"valid"') && responseData.includes('"summary"')) {
          console.log('\n✅ SUCCESS: Response includes validation result');
          resolve(true);
        } else {
          console.log('\n❓ UNCLEAR: Response format unclear');
          resolve(false);
        }
      } else {
        console.log('\n❌ FAILED: No response received');
        resolve(false);
      }
    });

    server.on('error', (err) => {
      console.error('❌ Server error:', err);
      reject(err);
    });

    // Send initialize request
    setTimeout(() => {
      console.log('📤 Sending initialize request...');
      server.stdin.write(JSON.stringify(initRequest) + '\n');
      requestsSent++;
    }, 100);

    // Send tool request
    setTimeout(() => {
      console.log('📤 Sending validate_workflow request...');
      server.stdin.write(JSON.stringify(toolRequest) + '\n');
      requestsSent++;
    }, 500);

    // Close stdin and wait for response
    setTimeout(() => {
      console.log('📤 Closing server stdin...');
      server.stdin.end();
    }, 1000);

    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('⏰ Test timeout, killing server...');
      server.kill();
      resolve(false);
    }, 10000);
  });
}

// Run the test
testMCPServer()
  .then((success) => {
    console.log('\n🎯 Test Result:', success ? 'PASSED ✅' : 'FAILED ❌');
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Test Error:', error);
    process.exit(1);
  });
