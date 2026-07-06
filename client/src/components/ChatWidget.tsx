import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

interface Step { step: string; status: string; detail: string; }
interface Message {
  from: 'user' | 'agent';
  text: string;
  steps?: Step[];
  suggestions?: string[];
}

const STEP_LABELS: Record<string, string> = {
  sanitize: 'Sanitize input',
  security_filter: 'Security filter',
  scope_check: 'Project-scope check',
  knowledge_lookup: 'Knowledge lookup',
  answer_redaction: 'Answer redaction',
};

const stepColor = (status: string) =>
  status === 'blocked' ? 'text-red-600'
    : status === 'matched' || status === 'passed' || status === 'clean' ? 'text-green-600'
      : status === 'redacted' ? 'text-orange-600'
        : 'text-gray-500';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      from: 'agent',
      text: 'Hi! I\'m the Education Hub help assistant. Ask me anything about this project — logins, exams, report cards, schedules, moderation, and more. (I only answer project questions, and never share credentials.)',
      suggestions: ['What is Education Hub?', 'How do report cards work?', 'How do new users register?'],
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || sending) return;
    setMessages((m) => [...m, { from: 'user', text: question }]);
    setInput('');
    setSending(true);
    try {
      const r = await api.post('/chat/ask', { question });
      setMessages((m) => [...m, {
        from: 'agent',
        text: r.data.answer,
        steps: r.data.steps,
        suggestions: r.data.suggestions,
      }]);
    } catch {
      setMessages((m) => [...m, { from: 'agent', text: 'Something went wrong — please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating bubble */}
      <button onClick={() => setOpen(!open)}
        title="Project help"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition flex items-center justify-center">
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: '520px' }}>
          <div className="px-4 py-3 bg-indigo-600 text-white">
            <p className="font-semibold text-sm">Education Hub Help</p>
            <p className="text-[11px] text-indigo-200">Rule-based assistant · project questions only · no AI</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i}>
                <div className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line ${
                    m.from === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}>
                    {m.text}
                  </div>
                </div>

                {/* Pipeline steps executed for this answer */}
                {m.steps && (
                  <details className="mt-1 ml-1">
                    <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">
                      Processing steps ({m.steps.length})
                    </summary>
                    <div className="mt-1 space-y-0.5 bg-white border border-gray-100 rounded-lg p-2">
                      {m.steps.map((s, j) => (
                        <p key={j} className="text-[10px] text-gray-500">
                          <span className="font-mono text-gray-400">{j + 1}.</span>{' '}
                          <span className="font-medium">{STEP_LABELS[s.step] || s.step}</span>{' '}
                          <span className={`font-semibold ${stepColor(s.status)}`}>[{s.status}]</span>{' '}
                          — {s.detail}
                        </p>
                      ))}
                    </div>
                  </details>
                )}

                {/* Follow-up suggestions */}
                {m.from === 'agent' && m.suggestions && m.suggestions.length > 0 && i === messages.length - 1 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.suggestions.map((s) => (
                      <button key={s} onClick={() => ask(s)}
                        className="text-[11px] px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 hover:bg-indigo-100 transition">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && <p className="text-xs text-gray-400 ml-1">Thinking through the steps…</p>}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="p-3 border-t border-gray-200 bg-white flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the project..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" disabled={!input.trim() || sending}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
