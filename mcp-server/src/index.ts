#!/usr/bin/env node

/**
 * NotebookLM MCP Server
 *
 * Exposes NotebookLM operations as MCP tools for AI assistants (Claude, etc.).
 * Proxies all requests to the FastAPI backend — no duplicate logic.
 *
 * Prerequisites: FastAPI backend running on API_URL (default http://localhost:8000)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

const API_URL = process.env.NOTEBOOKLM_API_URL || 'http://localhost:8000';

async function apiGet(path: string): Promise<any> {
  const resp = await fetch(`${API_URL}${path}`);
  if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function apiPost(path: string, body: Record<string, unknown> = {}): Promise<any> {
  const resp = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

async function main() {
  const server = new Server({
    name: 'notebooklm-omni-bridge',
    version: '2.0.0',
  });

  const tools: Tool[] = [
    {
      name: 'notebooklm_list_notebooks',
      description: 'List all NotebookLM notebooks',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'notebooklm_ingest',
      description: 'Ingest a URL or text into a NotebookLM notebook. Source type is auto-detected.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to ingest' },
          text: { type: 'string', description: 'Plain text to ingest' },
          title: { type: 'string', description: 'Title for text sources' },
          notebook_id: { type: 'string', description: 'Target notebook ID (optional)' }
        }
      }
    },
    {
      name: 'notebooklm_chat',
      description: 'Ask a question to a NotebookLM notebook',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Chat message' },
          notebook_id: { type: 'string', description: 'Notebook ID (optional, uses current if omitted)' }
        },
        required: ['message']
      }
    },
    {
      name: 'notebooklm_create_notebook',
      description: 'Create a new NotebookLM notebook',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Notebook name' }
        },
        required: ['name']
      }
    },
    {
      name: 'notebooklm_status',
      description: 'Get current connection and auth status',
      inputSchema: { type: 'object', properties: {} }
    }
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'notebooklm_list_notebooks': {
          const data = await apiGet('/notebooks');
          return textResult(JSON.stringify(data, null, 2));
        }

        case 'notebooklm_ingest': {
          const { url, text, title, notebook_id } = args as Record<string, string>;
          const body: Record<string, unknown> = {};
          if (url) body.url = url;
          if (text) body.text = text;
          if (title) body.title = title;
          if (notebook_id) body.notebook_id = notebook_id;
          const data = await apiPost('/ingest', body);
          return textResult(
            data.success
              ? `Ingested successfully (source: ${data.source_id})`
              : `Ingest failed: ${data.error}`
          );
        }

        case 'notebooklm_chat': {
          const { message, notebook_id } = args as { message: string; notebook_id?: string };
          const data = await apiPost('/chat', { message, notebook_id });
          if (data.error) return textResult(`Error: ${data.error}`);
          return textResult(data.response);
        }

        case 'notebooklm_create_notebook': {
          const { name: nbName } = args as { name: string };
          const data = await apiPost(`/notebooks?name=${encodeURIComponent(nbName)}`);
          return textResult(JSON.stringify(data, null, 2));
        }

        case 'notebooklm_status': {
          const data = await apiGet('/status');
          return textResult(JSON.stringify(data, null, 2));
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return textResult(`Error: ${error.message}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`NotebookLM MCP Server started (backend: ${API_URL})`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
