'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import SampleChat from '@/components/SampleChat';
import {
  STATUS_OPTIONS,
  statusBadgeClass,
  statusLabelJa,
  type SampleStatus,
  toSampleStatus,
} from '@/lib/sampleStatus';

/**
 * トップページ（ / ）… AI トリアージ + 一時保存一覧
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type TroubleType = 'customer' | 'stuff';

type PageView =
  | 'home'
  | 'triageResult'
  | 'unresolvedChoice'
  | 'detailForm'
  | 'editRegistered';

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

type RegisteredSample = {
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
  status?: SampleStatus;
};

function canEditRegisteredStatus(status: string | null | undefined): boolean {
  const s = toSampleStatus(status);
  return s === 'Pending' || s === 'Temporarily Resolved';
}

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

  const [registered, setRegistered] = useState<RegisteredSample[]>([]);
  const [registeredKeyword, setRegisteredKeyword] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredStatus, setRegisteredStatus] = useState('');
  const [registeredDateFrom, setRegisteredDateFrom] = useState('');
  const [registeredDateTo, setRegisteredDateTo] = useState('');
  const [appliedRegisteredKeyword, setAppliedRegisteredKeyword] = useState('');
  const [appliedRegisteredEmail, setAppliedRegisteredEmail] = useState('');
  const [appliedRegisteredStatus, setAppliedRegisteredStatus] = useState('');
  const [appliedRegisteredDateFrom, setAppliedRegisteredDateFrom] = useState('');
  const [appliedRegisteredDateTo, setAppliedRegisteredDateTo] = useState('');

  const [selectedRegistered, setSelectedRegistered] = useState<RegisteredSample | null>(
    null,
  );
  const [editExpected, setEditExpected] = useState('');
  const [editActual, setEditActual] = useState('');
  const [editErrorCode, setEditErrorCode] = useState('');

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

  const loadRegistered = useCallback(async () => {
    const params = new URLSearchParams({ is_draft: 'false' });
    if (appliedRegisteredKeyword.trim()) {
      params.set('q', appliedRegisteredKeyword.trim());
    }
    if (appliedRegisteredEmail.trim()) {
      params.set('email', appliedRegisteredEmail.trim());
    }
    if (appliedRegisteredStatus) {
      params.set('status', appliedRegisteredStatus);
    }
    if (appliedRegisteredDateFrom) {
      params.set('date_from', appliedRegisteredDateFrom);
    }
    if (appliedRegisteredDateTo) {
      params.set('date_to', appliedRegisteredDateTo);
    }
    const res = await fetch(`${API_BASE_URL}/samples?${params.toString()}`);
    if (res.ok) {
      setRegistered(await res.json());
    }
  }, [
    appliedRegisteredKeyword,
    appliedRegisteredEmail,
    appliedRegisteredStatus,
    appliedRegisteredDateFrom,
    appliedRegisteredDateTo,
  ]);

  useEffect(() => {
    loadDrafts();
    loadRegistered();
  }, [loadDrafts, loadRegistered]);

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

  const goHome = () => {
    setSelectedRegistered(null);
    setEditExpected('');
    setEditActual('');
    setEditErrorCode('');
    setActionError('');
    setActionSuccess('');
    setView('home');
    loadDrafts();
    loadRegistered();
  };

  const handleResolved = () => {
    resetTriageSession();
    loadDrafts();
    loadRegistered();
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
      await loadRegistered();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '登録に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const openRegisteredSample = (sample: RegisteredSample) => {
    setSelectedRegistered(sample);
    setEditExpected(sample.expected_actions ?? '');
    setEditActual(sample.actual_actions ?? '');
    setEditErrorCode(sample.error_code ?? '');
    setName(sample.name);
    setPlace(sample.place);
    setTroubleType(
      sample.trouble_type === 'stuff' ? 'stuff' : 'customer',
    );
    setEmail('');
    setActionError('');
    setActionSuccess('');
    setView('editRegistered');
  };

  const handleRegisteredSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    if (!selectedRegistered || !canEditRegisteredStatus(selectedRegistered.status)) {
      return;
    }
    if (
      !name.trim() ||
      !place.trim() ||
      !troubleType ||
      !email.trim() ||
      !editExpected.trim() ||
      !editActual.trim()
    ) {
      setActionError('報告者名・場所・種別・メール・期待結果・実際の結果は必須です。');
      return;
    }
    if (!isValidEmail(email)) {
      setActionError('メールアドレスの形式が正しくありません。');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/samples/${selectedRegistered.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          date: selectedRegistered.date,
          place: place.trim(),
          trouble_type: troubleType,
          trouble_detail: selectedRegistered.trouble_detail ?? '',
          email: email.trim(),
          expected_actions: editExpected.trim(),
          actual_actions: editActual.trim(),
          error_code: editErrorCode.trim() || null,
          ai_initial_response: selectedRegistered.ai_initial_response ?? null,
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, `更新に失敗しました (${res.status})`));
      }
      setActionSuccess('更新しました。');
      goHome();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '更新に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisteredDelete = async () => {
    if (!selectedRegistered || !canEditRegisteredStatus(selectedRegistered.status)) {
      return;
    }
    if (!email.trim()) {
      setActionError('削除には登録時のメールアドレスが必要です。');
      return;
    }
    if (!isValidEmail(email)) {
      setActionError('メールアドレスの形式が正しくありません。');
      return;
    }
    if (
      !window.confirm(
        `サンプル #${selectedRegistered.id} を削除します。よろしいですか？`,
      )
    ) {
      return;
    }

    setSubmitting(true);
    setActionError('');
    try {
      const res = await fetch(
        `${API_BASE_URL}/samples/${selectedRegistered.id}?email=${encodeURIComponent(email.trim())}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        throw new Error(await readApiError(res, `削除に失敗しました (${res.status})`));
      }
      goHome();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '削除に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisteredSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedRegisteredKeyword(registeredKeyword);
    setAppliedRegisteredEmail(registeredEmail);
    setAppliedRegisteredStatus(registeredStatus);
    setAppliedRegisteredDateFrom(registeredDateFrom);
    setAppliedRegisteredDateTo(registeredDateTo);
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

      {view === 'editRegistered' && selectedRegistered && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">サンプル #{selectedRegistered.id}</h2>
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(selectedRegistered.status)}`}
            >
              ステータス: {statusLabelJa(selectedRegistered.status)}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            日時: {new Date(selectedRegistered.date).toLocaleString('ja-JP')}
          </p>

          {canEditRegisteredStatus(selectedRegistered.status) ? (
            <form onSubmit={handleRegisteredSave} className="flex flex-col gap-2 text-sm">
              <label className="flex flex-col gap-1">
                <span className="font-semibold">実施した操作と期待結果 *</span>
                <textarea
                  value={editExpected}
                  onChange={(e) => setEditExpected(e.target.value)}
                  rows={3}
                  className="rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold">実施した操作と実際の結果 *</span>
                <textarea
                  value={editActual}
                  onChange={(e) => setEditActual(e.target.value)}
                  rows={3}
                  className="rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold">エラーコード（任意）</span>
                <input
                  type="text"
                  value={editErrorCode}
                  onChange={(e) => setEditErrorCode(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-2"
                />
              </label>
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
                placeholder="登録時メール（保存・削除の確認用）*"
                className="rounded border border-gray-300 px-3 py-2"
              />
              {actionError && <p className="text-sm text-red-700">{actionError}</p>}
              {actionSuccess && <p className="text-sm text-emerald-700">{actionSuccess}</p>}
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {submitting ? '保存中…' : '保存'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleRegisteredDelete}
                  className="rounded border border-red-600 bg-white px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  削除
                </button>
                <button
                  type="button"
                  onClick={goHome}
                  className="text-sm text-gray-600 underline"
                >
                  キャンセル
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 rounded border border-gray-200 bg-gray-50 px-4 py-4 text-sm">
              <p className="text-gray-600">
                完全対応済みのため、内容の編集・削除はできません。
              </p>
              {selectedRegistered.actual_actions && (
                <p>
                  <span className="font-semibold text-gray-700">実際の結果: </span>
                  {selectedRegistered.actual_actions}
                </p>
              )}
              {selectedRegistered.expected_actions && (
                <p>
                  <span className="font-semibold text-gray-700">期待結果: </span>
                  {selectedRegistered.expected_actions}
                </p>
              )}
              <p>
                <span className="font-semibold text-gray-700">報告者: </span>
                {selectedRegistered.name} / {selectedRegistered.place} /{' '}
                {selectedRegistered.trouble_type}
              </p>
              <button
                type="button"
                onClick={goHome}
                className="text-sm text-gray-600 underline"
              >
                戻る
              </button>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {!canEditRegisteredStatus(selectedRegistered.status) && (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="登録時メール（チャット送信用）*"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            )}
            <SampleChat
              sampleId={selectedRegistered.id}
              mode="staff"
              ownerEmail={email}
            />
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

      {view === 'home' && (
        <section className="mt-10 border-t border-gray-200 pt-8">
          <h2 className="mb-3 text-lg font-semibold">登録済みサンプル</h2>
          <form onSubmit={handleRegisteredSearch} className="mb-4 flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                value={registeredKeyword}
                onChange={(e) => setRegisteredKeyword(e.target.value)}
                placeholder="キーワードで検索"
                className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                value={registeredEmail}
                onChange={(e) => setRegisteredEmail(e.target.value)}
                placeholder="登録時メールで絞り込み"
                className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={registeredStatus}
                onChange={(e) => setRegisteredStatus(e.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
                aria-label="対応状況で絞り込み"
              >
                <option value="">すべての状況</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.labelJa}
                  </option>
                ))}
              </select>
              <label className="text-sm text-gray-600" htmlFor="reg-date-from">
                期間
              </label>
              <input
                id="reg-date-from"
                type="date"
                value={registeredDateFrom}
                onChange={(e) => setRegisteredDateFrom(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="text-sm text-gray-500">〜</span>
              <input
                id="reg-date-to"
                type="date"
                value={registeredDateTo}
                onChange={(e) => setRegisteredDateTo(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded bg-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-300"
              >
                検索
              </button>
            </div>
          </form>
          {registered.length === 0 ? (
            <p className="text-sm text-gray-600">登録済みサンプルはありません。</p>
          ) : (
            <ul className="space-y-3">
              {registered.map((sample) => (
                <li key={sample.id}>
                  <button
                    type="button"
                    onClick={() => openRegisteredSample(sample)}
                    className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-left text-sm shadow-sm hover:bg-gray-50"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">#{sample.id}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(sample.status)}`}
                      >
                        ステータス: {statusLabelJa(sample.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-600">日時: </span>
                      {new Date(sample.date).toLocaleString('ja-JP')}
                    </p>
                    {sample.actual_actions && (
                      <p className="mt-2">
                        <span className="font-medium text-gray-700">実際の結果: </span>
                        <span className="text-gray-800">{sample.actual_actions}</span>
                      </p>
                    )}
                    {!sample.actual_actions && sample.expected_actions && (
                      <p className="mt-2">
                        <span className="font-medium text-gray-700">期待結果: </span>
                        <span className="text-gray-800">{sample.expected_actions}</span>
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-500">
                      {canEditRegisteredStatus(sample.status)
                        ? 'クリックして確認・編集'
                        : 'クリックして確認（閲覧のみ）'}
                    </p>
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
