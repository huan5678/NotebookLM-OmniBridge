import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatInterface } from '../../src/frontend/components/ChatInterface'

describe('ChatInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render chat interface', () => {
    render(<ChatInterface />)
    expect(screen.getByText('開始與 NotebookLM 對談...')).toBeDefined()
  })

  it('should have input field for messages', () => {
    render(<ChatInterface />)
    expect(screen.getByPlaceholderText('輸入訊息...')).toBeDefined()
  })

  it('should send message on submit', async () => {
    const mockSend = vi.fn().mockResolvedValue('AI response')
    render(<ChatInterface onSendMessage={mockSend} />)
    
    const input = screen.getByPlaceholderText('輸入訊息...')
    const button = screen.getByText('傳送')
    
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith('Hello')
    })
  })

  it('should display response from assistant', async () => {
    const mockSend = vi.fn().mockResolvedValue('This is AI response')
    render(<ChatInterface onSendMessage={mockSend} />)
    
    const input = screen.getByPlaceholderText('輸入訊息...')
    const form = input.closest('form')!
    
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.submit(form)
    
    await waitFor(() => {
      expect(screen.getByText('This is AI response')).toBeDefined()
    })
  })

  it('should show loading state while waiting', async () => {
    const mockSend = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('Response'), 100))
    )
    render(<ChatInterface onSendMessage={mockSend} />)
    
    const input = screen.getByPlaceholderText('輸入訊息...')
    const form = input.closest('form')!
    
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.submit(form)
    
    // Should show loading
    expect(screen.getByText('...')).toBeDefined()
    
    await waitFor(() => {
      expect(screen.queryByText('...')).toBeNull()
    })
  })

  it('should maintain conversation history', async () => {
    const mockSend = vi.fn().mockResolvedValue('Response')
    const initialMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'First message',
        timestamp: new Date()
      }
    ]
    
    render(<ChatInterface onSendMessage={mockSend} initialMessages={initialMessages} />)
    
    expect(screen.getByText('First message')).toBeDefined()
  })
})
