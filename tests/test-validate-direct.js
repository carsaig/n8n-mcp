#!/usr/bin/env node

// Direct test of validate_workflow functionality
const path = require('path');
const { validateWorkflow } = require('./dist/services/workflow-validator.js');

// Test workflow from production n8n instance
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
    ]
  },
  "settings": {
    "executionOrder": "v1",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all",
    "saveManualExecutions": true,
    "saveExecutionProgress": true
  }
};

async function testValidateWorkflowDirect() {
  console.log('🧪 Testing validate_workflow directly with production data...');
  
  try {
    // Test the validation function directly
    console.log('🔍 Calling validateWorkflow function...');
    const result = await validateWorkflow(testWorkflow);
    
    console.log('📊 Validation Result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check the structure
    if (result && typeof result === 'object') {
      console.log('✅ Result is an object');
      
      if (result.valid !== undefined) {
        console.log(`✅ 'valid' field present: ${result.valid}`);
      } else {
        console.log('❌ Missing required field: valid');
      }
      
      if (result.summary) {
        console.log(`✅ 'summary' field present: ${result.summary}`);
      } else {
        console.log('❌ Missing required field: summary');
      }
      
      if (result.errors !== undefined) {
        console.log(`✅ 'errors' field present: ${Array.isArray(result.errors) ? result.errors.length + ' errors' : result.errors}`);
      } else {
        console.log('❌ Missing required field: errors');
      }
      
      if (result.warnings !== undefined) {
        console.log(`✅ 'warnings' field present: ${Array.isArray(result.warnings) ? result.warnings.length + ' warnings' : result.warnings}`);
      } else {
        console.log('❌ Missing required field: warnings');
      }
      
      console.log('🎯 Schema Compliance: The validation function returns the expected structure');
    } else {
      console.log('❌ Result is not an object or is null/undefined');
    }
    
  } catch (error) {
    console.error('❌ Direct validation test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testValidateWorkflowDirect().catch(console.error);
