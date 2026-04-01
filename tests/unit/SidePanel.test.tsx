import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SidePanel } from '../../src/frontend/components/SidePanel'

describe('SidePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render chat interface', () => {
    render(<SidePanel />)
    expect(screen.getByText('NotebookLM Omni-Bridge')).toBeDefined()
  })

  it('should have input field for messages', () => {
    render(<SidePanel />)
    expect(screen.getByPlaceholderText('輸入訊息...')).toBeDefined()
  })

  it('should send message on submit', async () => {
    const mockChat = vi.fn().mockResolvedValue('Hello back')
    render(<SidePanel onChat={mockChat} />)
    
    const input = screen.getByPlaceholderText('輸入訊息...')
    const form = input.closest('form')
    
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.submit(form!)
    
    // Should call onChat
    expect(mockChat).toHaveBeenCalledWith('Hello')
  })

  it('should display connection status', () => {
    render(<SidePanel />)
    expect(screen.getByText('已連接')).toBeDefined()
  })
})
