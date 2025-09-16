#!/usr/bin/env node

/**
 * Comprehensive debug script to trace the entire validate_workflow processing chain
 * This will help identify the exact point where the MCP error occurs
 */

const path = require('path');

// Import the MCP server directly to test the processing chain
async function debugValidateWorkflow() {
  console.log('🔍 Starting comprehensive validate_workflow debug analysis...\n');

  try {
    // Import the server class
    const { N8NDocumentationMCPServer } = require('./dist/mcp/server.js');

    console.log('✅ Successfully imported N8NDocumentationMCPServer');

    // Create server instance
    const server = new N8NDocumentationMCPServer();
    console.log('✅ Successfully created N8NDocumentationMCPServer instance');
    
    // Test workflow data
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
            "path": "test-webhook"
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
        "executionOrder": "v1"
      }
    };

    console.log('📋 Test workflow prepared');
    console.log('📋 Workflow nodes:', testWorkflow.nodes.length);
    console.log('📋 Workflow connections:', Object.keys(testWorkflow.connections).length);

    // Step 1: Test the validateWorkflow method directly
    console.log('\n🔍 Step 1: Testing validateWorkflow method directly...');
    
    try {
      const directResult = await server.validateWorkflow(testWorkflow, {});
      console.log('✅ Direct validateWorkflow call succeeded');
      console.log('📊 Direct result type:', typeof directResult);
      console.log('📊 Direct result keys:', Object.keys(directResult || {}));
      console.log('📊 Direct result.valid:', directResult?.valid);
      console.log('📊 Direct result.summary:', directResult?.summary);
      console.log('📊 Direct result structure:');
      console.log(JSON.stringify(directResult, null, 2));
    } catch (error) {
      console.log('❌ Direct validateWorkflow call failed:', error.message);
      return;
    }

    // Step 2: Test the executeTool method
    console.log('\n🔍 Step 2: Testing executeTool method...');

    try {
      const toolResult = await server.executeTool('validate_workflow', { workflow: testWorkflow });
      console.log('✅ executeTool call succeeded');
      console.log('📊 Tool result type:', typeof toolResult);
      console.log('📊 Tool result keys:', Object.keys(toolResult || {}));
      console.log('📊 Tool result.valid:', toolResult?.valid);
      console.log('📊 Tool result.summary:', toolResult?.summary);
      console.log('📊 Tool result structure:');
      console.log(JSON.stringify(toolResult, null, 2));
    } catch (error) {
      console.log('❌ executeTool call failed:', error.message);
      console.log('📊 Error details:', error);
      // Continue with other tests even if this fails
    }

    // Step 3: Test the sanitizeValidationResult method
    console.log('\n🔍 Step 3: Testing sanitizeValidationResult method...');
    
    try {
      const toolResult = await server.executeTool('validate_workflow', { workflow: testWorkflow });
      const sanitizedResult = server.sanitizeValidationResult(toolResult, 'validate_workflow');
      console.log('✅ sanitizeValidationResult call succeeded');
      console.log('📊 Sanitized result type:', typeof sanitizedResult);
      console.log('📊 Sanitized result keys:', Object.keys(sanitizedResult || {}));
      console.log('📊 Sanitized result.valid:', sanitizedResult?.valid);
      console.log('📊 Sanitized result.summary:', sanitizedResult?.summary);
      console.log('📊 Sanitized result structure:');
      console.log(JSON.stringify(sanitizedResult, null, 2));
    } catch (error) {
      console.log('❌ sanitizeValidationResult call failed:', error.message);
      return;
    }

    // Step 4: Simulate the MCP response formatting
    console.log('\n🔍 Step 4: Simulating MCP response formatting...');

    try {
      const toolResult = await server.executeTool('validate_workflow', { workflow: testWorkflow });

      // Simulate the MCP response formatting logic
      let responseText;
      let structuredContent = null;

      if (toolResult && typeof toolResult === 'object') {
        const cleanResult = server.sanitizeValidationResult(toolResult, 'validate_workflow');
        structuredContent = cleanResult;
        responseText = JSON.stringify(cleanResult, null, 2);

        console.log('✅ MCP response formatting simulation succeeded');
        console.log('📊 responseText length:', responseText.length);
        console.log('📊 structuredContent type:', typeof structuredContent);
        console.log('📊 structuredContent is null:', structuredContent === null);
        console.log('📊 structuredContent is undefined:', structuredContent === undefined);

        // Create the MCP response structure
        const mcpResponse = {
          content: [
            {
              type: 'text',
              text: responseText,
            },
          ],
        };

        // Apply the current logic
        if (structuredContent !== null) {
          mcpResponse.structuredContent = structuredContent;
        }

        console.log('📊 Final MCP response structure:');
        console.log('📊 - has content:', !!mcpResponse.content);
        console.log('📊 - has structuredContent:', 'structuredContent' in mcpResponse);
        console.log('📊 - structuredContent value:', mcpResponse.structuredContent);

        // Check schema compliance
        if ('structuredContent' in mcpResponse && mcpResponse.structuredContent) {
          console.log('\n✅ Schema compliance check: PASS');
          console.log('📊 structuredContent.valid:', mcpResponse.structuredContent.valid);
          console.log('📊 structuredContent.summary:', mcpResponse.structuredContent.summary);
        } else {
          console.log('\n❌ Schema compliance check: FAIL');
          console.log('📊 Missing or null structuredContent for tool with outputSchema');
        }

      } else {
        console.log('❌ Tool result is not a valid object');
      }

    } catch (error) {
      console.log('❌ MCP response formatting simulation failed:', error.message);
      console.log('📊 Error stack:', error.stack);
    }

    console.log('\n🎯 Debug analysis completed successfully!');
    
  } catch (error) {
    console.error('💥 Debug script failed:', error.message);
    console.error('📊 Error stack:', error.stack);
  }
}

// Run the debug analysis
debugValidateWorkflow()
  .then(() => {
    console.log('\n✅ Debug analysis finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Debug analysis crashed:', error);
    process.exit(1);
  });
