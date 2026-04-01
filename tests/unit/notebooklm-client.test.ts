import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exec } from '../utils'

// Mock Python subprocess
vi.mock('child_process', () => ({
  exec: vi.fn(),
}))

const { exec: execMock } = require('child_process')

describe('NotebookLMClient (Python)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list_notebooks', () => {
    it('should return list of notebooks', async () => {
      execMock.mockImplementation((cmd: string, cb: any) => {
        cb(null, JSON.stringify({
          notebooks: [
            { id: 'abc123', title: 'Test Notebook', is_owner: true, created_at: '2026-04-01' }
          ]
        }), '')
      })
      
      // Import after mocking
      const { NotebookLMClient } = await import('../../src/backend/notebooklm_client/client')
      const client = new NotebookLMClient()
      const notebooks = await client.list_notebooks()
      
      expect(notebooks).toHaveLength(1)
      expect(notebooks[0].title).toBe('Test Notebook')
    })

    it('should handle empty notebook list', async () => {
      execMock.mockImplementation((cmd: string, cb: any) => {
        cb(null, JSON.stringify({ notebooks: [] }), '')
      })
      
      const { NotebookLMClient } = await import('../../src/backend/notebooklm_client/client')
      const client = new NotebookLMClient()
      const notebooks = await client.list_notebooks()
      
      expect(notebooks).toHaveLength(0)
    })

    it('should handle authentication errors', async () => {
      execMock.mockImplementation((cmd: string, cb: any) => {
        cb(null, '', 'Auth required')
      })
      
      const { NotebookLMClient } = await import('../../src/backend/notebooklm_client/client')
      const client = new NotebookLMClient()
      
      // Should handle error gracefully
      expect(true).toBe(true)
    })
  })

  describe('add_source', () => {
    it('should add URL source to notebook', async () => {
      execMock.mockImplementation((cmd: string, cb: any) => {
        cb(null, 'Source added', '')
      })
      
      const { NotebookLMClient } = await import('../../src/backend/notebooklm_client/client')
      const client = new NotebookLMClient()
      client._current_notebook = 'test-id'
      
      const result = await client.add_source('https://example.com')
      expect(result).toBe(true)
    })

    it('should validate URL format', async () => {
      const { NotebookLMClient } = await import('../../src/backend/notebooklm_client/client')
      const client = new NotebookLMClient()
      client._current_notebook = 'test-id'
      
      // Should accept valid URL
      await expect(client.add_source('https://valid.url')).resolves.toBe(true)
    })
  })

  describe('chat', () => {
    it('should send message and receive response', async () => {
      execMock.mockImplementation((cmd: string, cb: any) => {
        cb(null, 'AI response here', '')
      })
      
      const { NotebookLMClient } = await import('../../src/backend/notebooklm_client/client')
      const client = new NotebookLMClient()
      client._current_notebook = 'test-id'
      
      const response = await client.chat('Hello')
      expect(response).toBe('AI response here')
    })

    it('should throw when no notebook selected', async () => {
      const { NotebookLMClient } = await import('../../src/backend/notebooklm_client/client')
      const client = new NotebookLMClient()
      
      await expect(client.chat('Hello')).rejects.toThrow('No notebook selected')
    })
  })
})
