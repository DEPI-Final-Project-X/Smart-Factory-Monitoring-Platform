import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BrainCircuit, Loader2, Send, User } from 'lucide-react'
import { sendChatMessage } from '../services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'

const SUGGESTIONS = [
  'Why is the machine showing high voltage readings?',
  'What causes vibration anomalies in factory machines?',
  'How do I interpret a high pressure drift alert?',
  'ما سبب ارتفاع درجة حرارة الماكينة؟',
]

function ChatBubble({ role, text, source }) {
  const isUser = role === 'user'
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${
          isUser ? 'bg-violet-500/20 text-violet-300' : 'bg-cyan-500/15 text-cyan-300'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <BrainCircuit className="h-4 w-4" />}
      </div>
      <div className={`max-w-[75%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-3xl px-4 py-3 text-sm leading-6 ${
            isUser
              ? 'rounded-tr-md bg-violet-500/15 text-slate-100'
              : 'rounded-tl-md border border-white/10 bg-slate-950/60 text-slate-200'
          }`}
          style={{ direction: /[\u0600-\u06FF]/.test(text) ? 'rtl' : 'ltr' }}
        >
          {text}
        </div>
        {source && !isUser && (
          <span className="px-1 text-xs text-slate-600">{source}</span>
        )}
      </div>
    </div>
  )
}

export function AiAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hello! I\'m your smart factory maintenance assistant. Ask me anything about machine faults, sensor readings, or maintenance actions — in English or Arabic.',
      source: '',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed || loading) return

    const userMsg = { role: 'user', text: trimmed, source: '' }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError('')

    try {
      // Build history excluding the welcome message
      const history = messages
        .slice(1)
        .map((m) => ({ role: m.role, text: m.text }))

      const data = await sendChatMessage(trimmed, history)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.answer, source: data.source },
      ])
    } catch (err) {
      setError(err.message ?? 'Failed to reach the backend. Is it running?')
      // Remove the user message we already appended so the user can retry
      setMessages((prev) => prev.slice(0, -1))
      setInput(trimmed)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col" style={{ minHeight: '600px' }}>
        <CardHeader>
          <CardTitle>AI Maintenance Assistant</CardTitle>
          <CardDescription>
            RAG-powered bilingual assistant using Cohere + smart factory knowledge base
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4">
          {/* Suggestion chips */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 transition hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-violet-200"
                  style={{ direction: /[\u0600-\u06FF]/.test(s) ? 'rtl' : 'ltr' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Message list */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto rounded-3xl border border-white/8 bg-slate-950/30 p-4" style={{ maxHeight: '420px', minHeight: '280px' }}>
            {messages.map((msg, i) => (
              <ChatBubble key={i} role={msg.role} text={msg.text} source={msg.source} />
            ))}
            {loading && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="rounded-3xl rounded-tl-md border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-500">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Error banner */}
          {error && (
            <p className="flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          {/* Input row */}
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Ask about machine faults, sensor readings, maintenance… (English or Arabic)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="flex-1 resize-none rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-violet-400/40 focus:ring-1 focus:ring-violet-400/20"
            />
            <Button
              className="h-11 w-11 shrink-0 p-0"
              disabled={!input.trim() || loading}
              onClick={() => sendMessage()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
