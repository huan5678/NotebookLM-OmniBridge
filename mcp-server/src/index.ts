#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

import { NotebookLMClient } from '@nac/core';
import { GoogleDriveClient } from '@nac/core';

async function main() {
  const server = new Server(
    {
      name: 'notebooklm-omni-bridge',
      version: '2.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Initialize clients
  const nlmClient = new NotebookLMClient({
    usePythonCLI: true,
    pythonPath: 'python3.11'
  });

  const driveClient = new GoogleDriveClient({
    credentialsPath: `${process.env.HOME}/.credentials/google-drive.json`,
    tokenPath: `${process.env.HOME}/.credentials/google-token.json`
  });

  // Tool definitions
  const tools: Tool[] = [
    {
      name: 'notebooklm_list_notebooks',
      description: 'List all NotebookLM notebooks',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'notebooklm_ingest',
      description: 'Ingest a URL or text into a NotebookLM notebook',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to ingest' },
          text: { type: 'string', description: 'Plain text to ingest' },
          notebookId: { type: 'string', description: 'Target notebook ID (optional)' }
        },
        required: []
      }
    },
    {
      name: 'notebooklm_chat',
      description: 'Ask a question to a NotebookLM notebook',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Chat message' },
          notebookId: { type: 'string', description: 'Notebook ID (optional, uses current if omitted)' }
        },
        required: ['message']
      }
    },
    {
      name: 'notebooklm_status',
      description: 'Get current connection status',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'notebooklm_list_notebooks':
          const notebooks = await nlmClient.listNotebooks();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(notebooks, null, 2)
              }
            ]
          };

        case 'notebooklm_ingest': {
          const { url, text, notebookId } = args as { url?: string; text?: string; notebookId?: string };
          
          if (notebookId) {
            await nlmClient.useNotebook(notebookId);
          }
          
          if (url) {
            // Ingest URL
            const success = await nlmClient.addSource(url);
            return {
              content: [
                {
                  type: 'text',
                  text: success ? `Successfully ingested URL: ${url}` : `Failed to ingest URL: ${url}`
                }
              ]
            };
          } else if (text) {
            // For text, we need to upload to Drive first, then ingest
            // TODO: Implement text → Drive → NotebookLM flow
            return {
              content: [{ type: 'text', text: 'Text ingestion not yet implemented' }]
            };
          } else {
            return {
              content: [{ type: 'text', text: 'Either url or text must be provided' }]
            };
          }
        }

        case 'notebooklm_chat': {
          const { message, notebookId } = args as { message: string; notebookId?: string };
          
          if (notebookId) {
            await nlmClient.useNotebook(notebookId);
          }
          
          const response = await nlmClient.chat(message);
          return {
            content: [
              {
                type: 'text',
                text: response
              }
            ]
          };
        }

        case 'notebooklm_status': {
          const notebooks = await nlmClient.listNotebooks();
          const current = nlmClient.getCurrentNotebook();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  connected: true,
                  currentNotebook: notebooks.find(nb => nb.id === current),
                  notebooks
                }, null, 2)
              }
            ]
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`
          }
        ]
      };
    }
  });

  // Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('NotebookLM MCP Server started');
}

main().catch((error) => {
  console.error('Fatal error in main:', error);
  process.exit(1);
});
