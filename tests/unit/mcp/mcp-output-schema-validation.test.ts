import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { N8NDocumentationMCPServer } from '../../../src/mcp/server';

// Mock the database and dependencies
vi.mock('../../../src/database/database-adapter');
vi.mock('../../../src/database/node-repository');
vi.mock('../../../src/templates/template-service');
vi.mock('../../../src/utils/logger');

class TestableN8NMCPServer extends N8NDocumentationMCPServer {
  // Expose the private helper methods for testing
  public testToolHasOutputSchema(toolName: string): boolean {
    return (this as any).toolHasOutputSchema(toolName);
  }

  public testFormatOutputSchemaResponse(data: any): any[] {
    return (this as any).formatOutputSchemaResponse(data);
  }
}

/**
 * Test MCP Output Schema Validation
 *
 * Tests that tools with outputSchema return properly formatted MCP responses
 * instead of raw JavaScript objects.
 *
 * Problem: Tools with outputSchema must return JSON strings in text format,
 * not raw objects, according to MCP protocol.
 */
describe('MCP Output Schema Validation', () => {
  let server: TestableN8NMCPServer;

  beforeEach(() => {
    // Set environment variable to use in-memory database
    process.env.NODE_DB_PATH = ':memory:';
    server = new TestableN8NMCPServer();
  });

  afterEach(() => {
    delete process.env.NODE_DB_PATH;
  });

  describe('Helper Methods', () => {
    it('should correctly identify tools with output schema', () => {
      expect(server.testToolHasOutputSchema('validate_node_minimal')).toBe(true);
      expect(server.testToolHasOutputSchema('validate_node_operation')).toBe(true);
      expect(server.testToolHasOutputSchema('validate_workflow')).toBe(true);
      expect(server.testToolHasOutputSchema('validate_workflow_connections')).toBe(true);
      expect(server.testToolHasOutputSchema('validate_workflow_expressions')).toBe(true);

      // Non-schema tools should return false
      expect(server.testToolHasOutputSchema('get_database_statistics')).toBe(false);
      expect(server.testToolHasOutputSchema('list_nodes')).toBe(false);
    });

    it('should format data as MCP-compliant JSON string response', () => {
      const testData = {
        nodeType: 'nodes-base.webhook',
        displayName: 'Webhook',
        valid: true,
        errors: [],
        warnings: []
      };

      const result = server.testFormatOutputSchemaResponse(testData);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('type', 'text');
      expect(result[0]).toHaveProperty('text');

      // Text should be valid JSON
      const parsedData = JSON.parse(result[0].text);
      expect(parsedData).toEqual(testData);
    });
  });

  describe('JSON Formatting Edge Cases', () => {
    it('should handle complex nested objects', () => {
      const complexData = {
        nodeType: 'nodes-base.complex',
        valid: false,
        errors: [
          {
            type: 'validation',
            property: 'config.nested.field',
            message: 'Required field missing',
            fix: 'Add the missing field'
          }
        ],
        warnings: [],
        suggestions: ['Consider using a different approach'],
        summary: {
          hasErrors: true,
          errorCount: 1,
          warningCount: 0,
          suggestionCount: 1
        }
      };

      const result = server.testFormatOutputSchemaResponse(complexData);
      const parsedData = JSON.parse(result[0].text);

      expect(parsedData).toEqual(complexData);
      expect(parsedData.errors[0].type).toBe('validation');
      expect(parsedData.summary.hasErrors).toBe(true);
    });

    it('should handle empty arrays and null values', () => {
      const dataWithNulls = {
        nodeType: 'nodes-base.test',
        valid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        metadata: null,
        summary: {
          hasErrors: false,
          errorCount: 0
        }
      };

      const result = server.testFormatOutputSchemaResponse(dataWithNulls);
      const parsedData = JSON.parse(result[0].text);

      expect(parsedData).toEqual(dataWithNulls);
      expect(parsedData.metadata).toBeNull();
      expect(Array.isArray(parsedData.errors)).toBe(true);
      expect(parsedData.errors).toHaveLength(0);
    });
  });
});
