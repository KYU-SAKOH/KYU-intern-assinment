'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * 問い合わせごとのチャット形式の対応履歴
 *
 * mode=staff … 園館スタッフ（投稿時に登録メールが必要）
 * mode=admin … 管理者（メール不要）
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type AuthorRole = 'staff' | 'admin';

type ChatMessage = {
  id: number;
  sample_id: number;
  author_role: AuthorRole;
  body: string;
  created_at: string;
};

type SampleChatProps = {
  sampleId: number;
  mode: AuthorRole;
  /** staff 投稿時に使う登録メール（親フォームと共有） */
  ownerEmail?: string;
};

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string') return data.detail;
  } catch {
    /* ignore */
  }
  return fallback;
}

export default function SampleChat({ sampleId, mode, ownerEmail = '' }: SampleChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/samples/${sampleId}/messages`);
      if (!res.ok) {
        throw new Error(await readApiError(res, `履歴の取得に失敗しました (${res.status})`));
      }
      setMessages(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : '履歴の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [sampleId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!body.trim()) {
      setError('メッセージを入力してください。');
      return;
    }
    if (mode === 'staff' && !ownerEmail.trim()) {
      setError('メッセージ送信には登録時のメールアドレスが必要です。');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/samples/${sampleId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_role: mode,
          body: body.trim(),
          email: mode === 'staff' ? ownerEmail.trim() : null,
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, `送信に失敗しました (${res.status})`));
      }
      setBody('');
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました。');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-3 py-2">
        <h3 className="text-sm font-semibold text-gray-900">対応履歴（チャット）</h3>
        <p className="text-xs text-gray-500">
          園館スタッフと管理者のやり取りを時系列で記録します。
        </p>
      </div>

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto px-3 py-3">
        {loading && <p className="text-xs text-gray-500">読み込み中…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-gray-500">まだメッセージはありません。</p>
        )}
        {messages.map((msg) => {
          const isAdmin = msg.author_role === 'admin';
          return (
            <div
              key={msg.id}
              className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  isAdmin
                    ? 'bg-slate-800 text-white'
                    : 'border border-gray-200 bg-gray-50 text-gray-900'
                }`}
              >
                <p
                  className={`mb-1 text-xs font-semibold ${
                    isAdmin ? 'text-slate-300' : 'text-gray-500'
                  }`}
                >
                  {isAdmin ? '管理者' : '園館スタッフ'}
                  <span className="ml-2 font-normal opacity-80">
                    {new Date(msg.created_at).toLocaleString('ja-JP')}
                  </span>
                </p>
                <p className="whitespace-pre-wrap">{msg.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="border-t border-gray-200 px-3 py-3">
        {mode === 'staff' && !ownerEmail.trim() && (
          <p className="mb-2 text-xs text-amber-700">
            送信するには、上の「登録時メール」を入力してください。
          </p>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder={mode === 'admin' ? '管理者として返信…' : 'スタッフとして送信…'}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="mt-2 rounded bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {sending ? '送信中…' : '送信'}
        </button>
      </form>
    </div>
  );
}
