#!/usr/bin/env node

const http = require('http');

// Test data - real production workflow from n8n.certain.cc
const testWorkflow = {
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
  }
};

async function testValidateWorkflow() {
  try {
    console.log('🧪 Testing validate_workflow with production n8n data...');

    // Step 1: Initialize session
    console.log('📡 Step 1: Initializing MCP session...');
    const initResponse = await makeRequest({
      "jsonrpc": "2.0",
      "id": 1,
      "method": "initialize",
      "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {
          "name": "production-validation-test",
          "version": "1.0.0"
        }
      }
    });

    const sessionId = initResponse.headers['mcp-session-id'];
    console.log(`✅ Session initialized: ${sessionId}`);

    // Step 2: Test validate_workflow with production data
    console.log('🔍 Step 2: Testing validate_workflow tool...');
    const validateResponse = await makeRequest({
      "jsonrpc": "2.0",
      "id": 2,
      "method": "tools/call",
      "params": {
        "name": "validate_workflow",
        "arguments": {
          "workflow": testWorkflow
        }
      }
    }, sessionId);

    console.log('📊 Validation Response:');
    console.log(JSON.stringify(validateResponse.data, null, 2));

    // Check for structuredContent
    if (validateResponse.data.result && validateResponse.data.result.structuredContent) {
      console.log('✅ SUCCESS: structuredContent field is present!');
      console.log('🎯 MCP Schema Compliance: WORKING');
    } else {
      console.log('❌ FAILURE: structuredContent field is missing!');
      console.log('🚨 MCP Schema Compliance: BROKEN');
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
  }
}

function makeRequest(data, sessionId = null) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': 'Bearer test-debug-token',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    if (sessionId) {
      options.headers['mcp-session-id'] = sessionId;
    }
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          // Handle event-stream format
          if (responseData.includes('event: message')) {
            const dataLine = responseData.split('\n').find(line => line.startsWith('data: '));
            if (dataLine) {
              const jsonData = dataLine.substring(6); // Remove 'data: '
              resolve({
                headers: res.headers,
                data: JSON.parse(jsonData)
              });
            } else {
              resolve({
                headers: res.headers,
                data: responseData
              });
            }
          } else {
            resolve({
              headers: res.headers,
              data: JSON.parse(responseData)
            });
          }
        } catch (error) {
          console.error('Failed to parse response:', responseData);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Run the test
testValidateWorkflow().catch(console.error);
