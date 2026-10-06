'use client';

import { useCallback, useEffect, useState } from 'react';

import { API_BASE_URL, readApiError } from '@/lib/api';
import { btnBlue } from '@/lib/buttonStyles';

/**
 * 問い合わせごとのチャット形式の対応履歴
 *
 * mode=staff … 園館スタッフ
 * mode=admin … 管理者
 *
 * 親画面（トップ／管理者）から sampleId と mode を受け取り、
 * GET/POST /samples/{id}/messages を呼ぶ。
 */

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
  /** true のとき履歴閲覧のみ（送信フォームを出さない） */
  readOnly?: boolean;
  /** staff 送信成功時（未読解除フロー用） */
  onStaffMessageSent?: () => void;
  /** 未読のコメント対応で返信を促す強調 */
  highlightReply?: boolean;
};

export default function SampleChat({
  sampleId,
  mode,
  readOnly = false,
  onStaffMessageSent,
  highlightReply = false,
}: SampleChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  // 初回マウント直後はまだ未取得なので true（空メッセージのチラつき防止）
  const [loading, setLoading] = useState(true);
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
    if (readOnly) return;
    setError('');
    if (!body.trim()) {
      setError('メッセージを入力してください。');
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
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, `送信に失敗しました (${res.status})`));
      }
      setBody('');
      await loadMessages();
      if (mode === 'staff') {
        onStaffMessageSent?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました。');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={
        highlightReply
          ? 'rounded border-2 border-amber-500 bg-amber-50/40 ring-2 ring-amber-200'
          : 'rounded border border-gray-200 bg-white'
      }
    >
      <div className="border-b border-gray-200 px-3 py-2">
        <h3 className="text-sm font-semibold text-gray-900">対応履歴（チャット）</h3>
        <p className="text-xs text-gray-500">
          園館スタッフと管理者のやり取りを時系列で記録します。
        </p>
        {highlightReply && (
          <p className="mt-2 text-sm font-semibold text-amber-900">
            ここに返信してください（未読解除の次のステップです）
          </p>
        )}
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

      {readOnly ? (
        <div className="border-t border-gray-200 px-3 py-3">
          <p className="text-xs text-gray-600">
            完全対応済みのため、スタッフからの追加投稿はできません。
          </p>
        </div>
      ) : (
        <form onSubmit={handleSend} className="border-t border-gray-200 px-3 py-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder={mode === 'admin' ? '管理者として返信…' : 'スタッフとして送信…'}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
          <button type="submit" disabled={sending} className={`mt-2 ${btnBlue}`}>
            {sending ? '送信中…' : '送信'}
          </button>
        </form>
      )}
    </div>
  );
}
