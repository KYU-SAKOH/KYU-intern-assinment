'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

/**
 * トップページ（ / ）… AI トリアージ + 一時保存一覧
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type TroubleType = 'customer' | 'stuff';

type PageView =
  | 'home'
  | 'triageResult'
  | 'unresolvedChoice'
  | 'detailForm';

type SimilarSample = {
  id: number;
  name: string;
  date: string;
  place: string;
  trouble_type: string;
  trouble_detail: string;
  expected_actions?: string | null;
  actual_actions?: string | null;
  error_code?: string | null;
  ai_initial_response?: string | null;
};

type TriageResult = {
  status: 'ok' | 'needs_reentry';
  reentry_reasons: string[];
  similar_samples: SimilarSample[];
  initial_response: string | null;
};

type DraftSample = {
  id: number;
  date: string;
  expected_actions?: string | null;
  actual_actions?: string | null;
  error_code?: string | null;
  is_draft?: boolean;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string') return data.detail;
    if (Array.isArray(data?.detail)) {
      return (
        data.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(' / ') ||
        fallback
      );
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export default function Home() {
  const [view, setView] = useState<PageView>('home');

  const [expectedActions, setExpectedActions] = useState('');
  const [actualActions, setActualActions] = useState('');
  const [errorCode, setErrorCode] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [triageError, setTriageError] = useState('');
  const [triage, setTriage] = useState<TriageResult | null>(null);

  const [drafts, setDrafts] = useState<DraftSample[]>([]);
  const [draftKeyword, setDraftKeyword] = useState('');
  const [appliedDraftKeyword, setAppliedDraftKeyword] = useState('');

  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [troubleType, setTroubleType] = useState<TroubleType | ''>('');
  const [email, setEmail] = useState('');

  const [detailMode, setDetailMode] = useState<'newComplete' | 'finalizeDraft'>('newComplete');
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [detailContext, setDetailContext] = useState<{
    expected: string;
    actual: string;
    error: string;
    aiResponse: string | null;
  } | null>(null);

  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDrafts = useCallback(async (q = appliedDraftKeyword) => {
    const params = new URLSearchParams({ is_draft: 'true' });
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`${API_BASE_URL}/samples?${params.toString()}`);
    if (res.ok) {
      setDrafts(await res.json());
    }
  }, [appliedDraftKeyword]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const resetTriageSession = () => {
    setExpectedActions('');
    setActualActions('');
    setErrorCode('');
    setTriage(null);
    setTriageError('');
    setName('');
    setPlace('');
    setTroubleType('');
    setEmail('');
    setDetailContext(null);
    setSelectedDraftId(null);
    setDetailMode('newComplete');
    setActionError('');
    setActionSuccess('');
    setView('home');
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setTriageError('');
    setActionError('');
    setActionSuccess('');
    setTriage(null);

    if (!expectedActions.trim() || !actualActions.trim()) {
      setTriageError(
        '「実施した操作と期待結果」「実施した操作と実際の結果」は必須です。',
      );
      return;
    }

    setAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_actions: expectedActions.trim(),
          actual_actions: actualActions.trim(),
          error_code: errorCode.trim() || null,
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, `分析に失敗しました (${res.status})`));
      }
      const data = (await res.json()) as TriageResult;
      setTriage(data);
      setView(data.status === 'needs_reentry' ? 'home' : 'triageResult');
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : '分析に失敗しました。');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResolved = () => {
    resetTriageSession();
    loadDrafts();
  };

  const handleUnresolved = () => {
    setActionError('');
    setView('unresolvedChoice');
  };

  const openDetailFormNew = () => {
    setDetailMode('newComplete');
    setSelectedDraftId(null);
    setDetailContext({
      expected: expectedActions.trim(),
      actual: actualActions.trim(),
      error: errorCode.trim(),
      aiResponse: triage?.initial_response ?? null,
    });
    setName('');
    setPlace('');
    setTroubleType('');
    setEmail('');
    setActionError('');
    setView('detailForm');
  };

  const openDetailFormForDraft = (draft: DraftSample) => {
    setDetailMode('finalizeDraft');
    setSelectedDraftId(draft.id);
    setDetailContext({
      expected: draft.expected_actions ?? '',
      actual: draft.actual_actions ?? '',
      error: draft.error_code ?? '',
      aiResponse: null,
    });
    setName('');
    setPlace('');
    setTroubleType('');
    setEmail('');
    setActionError('');
    setView('detailForm');
  };

  const handleTemporarySave = async () => {
    if (!triage || triage.status !== 'ok') return;
    setSubmitting(true);
    setActionError('');
    try {
      const res = await fetch(`${API_BASE_URL}/samples/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_actions: expectedActions.trim(),
          actual_actions: actualActions.trim(),
          error_code: errorCode.trim() || null,
          ai_initial_response: triage.initial_response,
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, `一時保存に失敗しました (${res.status})`));
      }
      resetTriageSession();
      await loadDrafts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '一時保存に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!name.trim() || !place.trim() || !troubleType || !email.trim()) {
      setActionError('報告者名・場所・種別・メールは必須です。');
      return;
    }
    if (!isValidEmail(email)) {
      setActionError('メールアドレスの形式が正しくありません。');
      return;
    }
    if (!detailContext) {
      setActionError('入力内容がありません。');
      return;
    }

    setSubmitting(true);
    try {
      if (detailMode === 'finalizeDraft' && selectedDraftId !== null) {
        const res = await fetch(`${API_BASE_URL}/samples/${selectedDraftId}/finalize`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            place: place.trim(),
            trouble_type: troubleType,
            email: email.trim(),
          }),
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, `登録に失敗しました (${res.status})`));
        }
        setActionSuccess('詳細を登録しました。');
      } else {
        const res = await fetch(`${API_BASE_URL}/samples/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            place: place.trim(),
            trouble_type: troubleType,
            email: email.trim(),
            expected_actions: detailContext.expected,
            actual_actions: detailContext.actual,
            error_code: detailContext.error || null,
            ai_initial_response: detailContext.aiResponse,
          }),
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, `登録に失敗しました (${res.status})`));
        }
        setActionSuccess('問い合わせを登録しました。');
      }
      resetTriageSession();
      await loadDrafts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '登録に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDraftSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedDraftKeyword(draftKeyword);
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">terravie トラブル報告フォーム</h1>
        <p className="mt-2 text-sm text-gray-600">
          新しいトラブルを入力すると、AI が類似事例と一次回答を提示します。
        </p>
        <nav className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/customer" className="text-blue-700 underline hover:text-blue-900">
            Customer 一覧
          </Link>
          <Link href="/staff" className="text-emerald-700 underline hover:text-emerald-900">
            Staff 一覧
          </Link>
          <Link href="/admin" className="text-gray-700 underline hover:text-gray-900">
            Administrator
          </Link>
        </nav>
      </header>

      {view === 'home' && (
        <>
          <form onSubmit={handleAnalyze} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">
                実施した操作と期待結果 <span className="text-red-600">*</span>
              </span>
              <textarea
                value={expectedActions}
                onChange={(e) => setExpectedActions(e.target.value)}
                rows={4}
                className="rounded border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">
                実施した操作と実際の結果 <span className="text-red-600">*</span>
              </span>
              <textarea
                value={actualActions}
                onChange={(e) => setActualActions(e.target.value)}
                rows={4}
                className="rounded border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">エラーコード（任意）</span>
              <input
                type="text"
                value={errorCode}
                onChange={(e) => setErrorCode(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2"
              />
            </label>
            {triageError && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {triageError}
              </p>
            )}
            <button
              type="submit"
              disabled={analyzing}
              className="rounded bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {analyzing ? 'AI 分析中…' : 'AI で類似事例・一次回答を取得'}
            </button>
          </form>

          {triage?.status === 'needs_reentry' && (
            <section className="mt-8 rounded border border-amber-300 bg-amber-50 px-4 py-4">
              <h2 className="font-semibold text-amber-950">再入力が必要です</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-950">
                {triage.reentry_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {view === 'triageResult' && triage?.status === 'ok' && (
        <section className="space-y-6">
          <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-4">
            <h2 className="font-semibold text-emerald-950">AI 一次回答</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-950">
              {triage.initial_response}
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-semibold">類似サンプル</h2>
            {triage.similar_samples.length === 0 ? (
              <p className="text-sm text-gray-600">類似する過去事例は見つかりませんでした。</p>
            ) : (
              <ul className="space-y-3">
                {triage.similar_samples.map((sample) => (
                  <li key={sample.id} className="rounded border border-gray-200 px-3 py-3 text-sm">
                    <p className="font-medium">#{sample.id} {sample.name}</p>
                    {sample.expected_actions && (
                      <p className="mt-1 text-gray-700">{sample.expected_actions}</p>
                    )}
                    {sample.actual_actions && (
                      <p className="mt-1 text-gray-600">{sample.actual_actions}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleResolved}
              className="rounded border border-emerald-600 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              解決済み
            </button>
            <button
              type="button"
              onClick={handleUnresolved}
              className="rounded bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
            >
              未解決
            </button>
          </div>
        </section>
      )}

      {view === 'unresolvedChoice' && (
        <section className="space-y-4 rounded border border-gray-200 bg-gray-50 px-4 py-4">
          <h2 className="font-semibold">未解決 — 次の操作を選んでください</h2>
          <p className="text-sm text-gray-600">
            一時保存するとトップページに表示され、あとから詳細を入力できます。
          </p>
          {actionError && <p className="text-sm text-red-700">{actionError}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleTemporarySave}
              className="rounded border border-gray-400 bg-white px-4 py-3 text-sm font-semibold hover:bg-gray-100 disabled:opacity-60"
            >
              {submitting ? '保存中…' : '一時保存'}
            </button>
            <button
              type="button"
              onClick={openDetailFormNew}
              className="rounded bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800"
            >
              詳細を入力
            </button>
            <button
              type="button"
              onClick={() => setView('triageResult')}
              className="text-sm text-gray-600 underline"
            >
              戻る
            </button>
          </div>
        </section>
      )}

      {view === 'detailForm' && detailContext && (
        <section className="space-y-4">
          <div className="rounded border border-gray-200 bg-white px-4 py-3 text-sm">
            <p className="font-semibold text-gray-700">トリアージ内容（参照）</p>
            <p className="mt-2 whitespace-pre-wrap">
              <span className="text-gray-500">期待結果: </span>
              {detailContext.expected}
            </p>
            <p className="mt-2 whitespace-pre-wrap">
              <span className="text-gray-500">実際の結果: </span>
              {detailContext.actual}
            </p>
            {detailContext.error && (
              <p className="mt-2">エラーコード: {detailContext.error}</p>
            )}
          </div>
          <form onSubmit={handleDetailSubmit} className="flex flex-col gap-2 text-sm">
            <h2 className="font-semibold">
              {detailMode === 'finalizeDraft' ? '一時保存の詳細入力' : '詳細を入力'}
            </h2>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="報告者名 *"
              className="rounded border border-gray-300 px-3 py-2"
            />
            <input
              type="text"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="発生場所 *"
              className="rounded border border-gray-300 px-3 py-2"
            />
            <select
              value={troubleType}
              onChange={(e) => setTroubleType(e.target.value as TroubleType | '')}
              className="rounded border border-gray-300 px-3 py-2"
            >
              <option value="">種別を選択 *</option>
              <option value="customer">customer</option>
              <option value="stuff">stuff</option>
            </select>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス *"
              className="rounded border border-gray-300 px-3 py-2"
            />
            <p className="text-xs text-gray-500">発生日時は登録時に自動で記録されます。</p>
            {actionError && <p className="text-sm text-red-700">{actionError}</p>}
            {actionSuccess && <p className="text-sm text-emerald-700">{actionSuccess}</p>}
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {submitting ? '登録中…' : '登録する'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (detailMode === 'finalizeDraft') {
                    resetTriageSession();
                    loadDrafts();
                  } else {
                    setView('unresolvedChoice');
                  }
                }}
                className="text-sm text-gray-600 underline"
              >
                キャンセル
              </button>
            </div>
          </form>
        </section>
      )}

      {view === 'home' && (
        <section className="mt-10 border-t border-gray-200 pt-8">
          <h2 className="mb-3 text-lg font-semibold">一時保存中のサンプル</h2>
          <form onSubmit={handleDraftSearch} className="mb-4 flex gap-2">
            <input
              type="search"
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
              placeholder="キーワードで検索"
              className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-300"
            >
              検索
            </button>
          </form>
          {drafts.length === 0 ? (
            <p className="text-sm text-gray-600">一時保存はありません。</p>
          ) : (
            <ul className="space-y-3">
              {drafts.map((draft) => (
                <li key={draft.id}>
                  <button
                    type="button"
                    onClick={() => openDetailFormForDraft(draft)}
                    className="w-full rounded border border-dashed border-gray-400 bg-amber-50/50 px-4 py-3 text-left text-sm hover:bg-amber-50"
                  >
                    <p className="text-xs text-gray-500">
                      {new Date(draft.date).toLocaleString('ja-JP')}
                    </p>
                    {draft.expected_actions && (
                      <p className="mt-1">
                        <span className="font-medium text-gray-700">期待結果: </span>
                        <span className="text-gray-800">{draft.expected_actions}</span>
                      </p>
                    )}
                    {draft.actual_actions && (
                      <p className="mt-1">
                        <span className="font-medium text-gray-700">実際の結果: </span>
                        <span className="text-gray-800">{draft.actual_actions}</span>
                      </p>
                    )}
                    {draft.error_code && (
                      <p className="mt-1 text-xs text-gray-600">エラー: {draft.error_code}</p>
                    )}
                    <p className="mt-2 text-xs text-amber-800">クリックして詳細を入力</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
