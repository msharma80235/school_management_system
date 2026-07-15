import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

interface Book { id: string; title: string; author: string; subject: string | null; for_my_class: boolean; }
interface ChapterMeta { index: number; title: string; word_count: number; preview: string; }
interface Explanation { summary: string; key_points: string[]; key_terms: string[]; source: 'ai' | 'rule_based'; language: 'hi' | 'en'; }
interface ChapterFull { book: { id: string; title: string; author: string }; chapter: { index: number; title: string; word_count: number }; text: string; explanation: Explanation; }

// The browser's built-in speech synthesis — free, offline, no external service.
const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

export default function BookReader() {
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [chapter, setChapter] = useState<ChapterFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Playback
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reading, setReading] = useState<'text' | 'explanation' | null>(null);
  const [rate, setRate] = useState(1);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  useEffect(() => {
    api.get('/reader/books').then((r) => setBooks(r.data.books)).catch(() => setError('Could not load books'));
    return () => { if (speechSupported) window.speechSynthesis.cancel(); };
  }, []);

  const stop = () => {
    if (speechSupported) window.speechSynthesis.cancel();
    setSpeaking(false); setPaused(false); setReading(null);
  };

  const openBook = async (book: Book) => {
    stop();
    setActiveBook(book); setChapter(null); setChapters([]); setError('');
    try {
      const r = await api.get(`/reader/books/${book.id}/chapters`);
      setChapters(r.data.chapters);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not read this book');
    }
  };

  const openChapter = async (index: number) => {
    stop();
    setLoading(true); setError(''); setChapter(null);
    try {
      const r = await api.get(`/reader/books/${activeBook!.id}/chapters/${index}`);
      setChapter(r.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not open this chapter');
    } finally {
      setLoading(false);
    }
  };

  // Speak text in chunks (long strings can silently truncate in some browsers).
  const speak = (text: string, lang: 'hi' | 'en', what: 'text' | 'explanation') => {
    if (!speechSupported) { setError('Your browser does not support read-aloud.'); return; }
    window.speechSynthesis.cancel();
    const chunks = text.match(/[^.!?।]+[.!?।]*\s*/g) || [text];
    let i = 0;
    const next = () => {
      if (i >= chunks.length) { setSpeaking(false); setReading(null); return; }
      const u = new SpeechSynthesisUtterance(chunks[i].trim());
      u.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
      u.rate = rateRef.current;
      u.onend = () => { i++; next(); };
      u.onerror = () => { setSpeaking(false); setReading(null); };
      window.speechSynthesis.speak(u);
    };
    setSpeaking(true); setPaused(false); setReading(what); next();
  };

  const togglePause = () => {
    if (!speechSupported) return;
    if (paused) { window.speechSynthesis.resume(); setPaused(false); }
    else { window.speechSynthesis.pause(); setPaused(true); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Read &amp; Listen</h1>
        <p className="text-gray-500 text-sm mt-1">Open a book, listen to a chapter read aloud, and get a simple explanation to help you understand.</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {!speechSupported && <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">Read-aloud isn't supported in this browser — you can still read the text and explanation.</div>}

      {!activeBook ? (
        books.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">No readable books yet. Ask your teacher to add books to the library.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((b) => (
              <button key={b.id} onClick={() => openBook(b)}
                className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-400 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{b.title}</h3>
                  {b.for_my_class && <span className="shrink-0 text-[10px] font-semibold uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">My class</span>}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">by {b.author}</p>
                {b.subject && <p className="text-xs text-gray-400 mt-2">{b.subject}</p>}
              </button>
            ))}
          </div>
        )
      ) : (
        <div>
          <button onClick={() => { stop(); setActiveBook(null); setChapter(null); }} className="text-sm text-indigo-600 hover:text-indigo-800 mb-4">← All books</button>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Chapter list */}
            <div className="lg:col-span-1">
              <h2 className="font-semibold text-gray-900 mb-1">{activeBook.title}</h2>
              <p className="text-sm text-gray-500 mb-3">by {activeBook.author}</p>
              <div className="space-y-1">
                {chapters.map((c) => (
                  <button key={c.index} onClick={() => openChapter(c.index)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${chapter?.chapter.index === c.index ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
                    {c.title}
                    <span className="block text-[11px] text-gray-400">{c.word_count} words</span>
                  </button>
                ))}
                {chapters.length === 0 && <p className="text-sm text-gray-400">Reading the book…</p>}
              </div>
            </div>

            {/* Reader pane */}
            <div className="lg:col-span-2">
              {loading ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">Opening chapter…</div>
              ) : !chapter ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">Pick a chapter to start reading and listening.</div>
              ) : (
                <div className="space-y-4">
                  {/* Playback controls */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-0 z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => speak(chapter.text, chapter.explanation.language, 'text')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${reading === 'text' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
                        ▶ Listen to chapter
                      </button>
                      <button onClick={() => speak([chapter.explanation.summary, ...chapter.explanation.key_points].join('. '), chapter.explanation.language, 'explanation')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${reading === 'explanation' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                        ▶ Listen to explanation
                      </button>
                      {speaking && (
                        <>
                          <button onClick={togglePause} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">{paused ? 'Resume' : 'Pause'}</button>
                          <button onClick={stop} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">Stop</button>
                        </>
                      )}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-xs text-gray-500">Speed</span>
                        <select value={rate} onChange={(e) => setRate(Number(e.target.value))}
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                          {[0.75, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{r}×</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-emerald-900">In simple words</h3>
                      <span className="text-[10px] uppercase font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {chapter.explanation.source === 'ai' ? 'AI explanation' : 'auto summary'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{chapter.explanation.summary}</p>
                    {chapter.explanation.key_points.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-gray-700 mt-2 space-y-1">
                        {chapter.explanation.key_points.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    )}
                    {chapter.explanation.key_terms.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {chapter.explanation.key_terms.map((t) => <span key={t} className="text-xs bg-white border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">{t}</span>)}
                      </div>
                    )}
                  </div>

                  {/* Chapter text */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="font-semibold text-gray-900 mb-2">{chapter.chapter.title}</h3>
                    <p className="text-[15px] leading-7 text-gray-800 whitespace-pre-line">{chapter.text}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
