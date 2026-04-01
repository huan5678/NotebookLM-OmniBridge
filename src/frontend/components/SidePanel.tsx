import React, { useState, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface SidePanelProps {
  onIngest?: (url: string) => Promise<void>
  onChat?: (message: string) => Promise<string>
}

export function SidePanel({ onIngest, onChat }: SidePanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'ingest'>('chat')

  useEffect(() => {
    setIsConnected(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      if (onChat) {
        const response = await onChat(input)
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="side-panel">
      <header className="panel-header">
        <h1>NotebookLM Omni-Bridge</h1>
        <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '已連接' : '未連接'}
        </span>
      </header>

      <nav className="tab-nav">
        <button
          className={activeTab === 'chat' ? 'active' : ''}
          onClick={() => setActiveTab('chat')}
        >
          對談
        </button>
        <button
          className={activeTab === 'ingest' ? 'active' : ''}
          onClick={() => setActiveTab('ingest')}
        >
          吸取
        </button>
      </nav>

      <main className="panel-content">
        {activeTab === 'chat' && (
          <div className="chat-container">
            <div className="messages">
              {messages.length === 0 && (
                <p className="empty-state">開始對談...</p>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <span className="role">{msg.role === 'user' ? '你' : 'AI'}</span>
                  <p>{msg.content}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="chat-input">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="輸入訊息..."
                disabled={isLoading}
              />
              <button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? '...' : '傳送'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'ingest' && (
          <div className="ingest-container">
            <p>輸入網址來吸取內容到 NotebookLM</p>
          </div>
        )}
      </main>
    </div>
  )
}
