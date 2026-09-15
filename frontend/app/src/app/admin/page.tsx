'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  STATUS_OPTIONS,
  statusBadgeClass,
  statusLabelJa,
  toSampleStatus,
  type SampleStatus,
} from '@/lib/sampleStatus';
import type { components } from '@/types/api';

/**
 * 管理者画面（ /admin ）
 *
 * できること:
 *  - キーワード / 種別 / 対応状況 / 期間で検索
 *  - ラジオボタンで対応状況を変更（画面は日本語、保存値は英語）
 *  - 管理者コメントを付けて保存
 *
 * 使う API:
 *  - GET  /samples?q=&trouble_type=&status=&date_from=&date_to=
 *  - PATCH /samples/{id}/admin  … status / admin_comment だけ更新
 */

type Sample = components['schemas']['SampleResponse'];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export default function AdminPage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  // 行ごとの編集中ステータス / コメント（保存ボタンを押すまでの下書き）
  const [draftStatus, setDraftStatus] = useState<Record<number, SampleStatus>>({});
  const [draftComment, setDraftComment] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // ===== 検索用（入力中 / 適用済みを分ける） =====
  // 「検索」を押すまで一覧を変えない → Staff 画面と同じパターン
  const [keyword, setKeyword] = useState('');
  const [searchTroubleType, setSearchTroubleType] = useState('');
  // 対応状況のプルダウン（空文字 = すべての状況）
  const [searchStatus, setSearchStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [appliedTroubleType, setAppliedTroubleType] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');

  /**
   * 一覧取得。applied〜 の値だけをクエリに載せる。
   * useCallback の依存に applied〜 を入れると、検索確定のたびに関数が作り直され、
   * 下の useEffect が再実行されて一覧が更新される。
   */
  const loadSamples = useCallback(async () => {
    const params = new URLSearchParams();
    if (appliedKeyword.trim()) {
      params.set('q', appliedKeyword.trim());
    }
    if (appliedTroubleType) {
      params.set('trouble_type', appliedTroubleType);
    }
    // status は英語のまま送る（DB の値と一致させる）。空なら条件に含めない＝全件
    if (appliedStatus) {
      params.set('status', appliedStatus);
    }
    if (appliedDateFrom) {
      params.set('date_from', appliedDateFrom);
    }
    if (appliedDateTo) {
      params.set('date_to', appliedDateTo);
    }

    const query = params.toString();
    const res = await fetch(`${API_BASE_URL}/samples${query ? `?${query}` : ''}`);
    if (!res.ok) {
      setError(`一覧の取得に失敗しました (${res.status})`);
      return;
    }
    const data: Sample[] = await res.json();
    setSamples(data);

    // 取得結果で下書きを初期化（保存後の再読込でもラジオ・コメントがずれないように）
    const nextStatus: Record<number, SampleStatus> = {};
    const nextComment: Record<number, string> = {};
    for (const s of data) {
      nextStatus[s.id] = toSampleStatus(s.status);
      nextComment[s.id] = s.admin_comment ?? '';
    }
    setDraftStatus(nextStatus);
    setDraftComment(nextComment);
  }, [appliedKeyword, appliedTroubleType, appliedStatus, appliedDateFrom, appliedDateTo]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  /** 「検索」ボタン: 入力中の条件を applied〜 にコピー → loadSamples が走る */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedKeyword(keyword);
    setAppliedTroubleType(searchTroubleType);
    setAppliedStatus(searchStatus);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
  };

  /** 検索条件を全部リセットして全件表示に戻す */
  const handleClearSearch = () => {
    setKeyword('');
    setSearchTroubleType('');
    setSearchStatus('');
    setDateFrom('');
    setDateTo('');
    setAppliedKeyword('');
    setAppliedTroubleType('');
    setAppliedStatus('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
  };

  const hasActiveSearch =
    Boolean(appliedKeyword) ||
    Boolean(appliedTroubleType) ||
    Boolean(appliedStatus) ||
    Boolean(appliedDateFrom) ||
    Boolean(appliedDateTo);

  /**
   * 1件分の status / admin_comment を保存する。
   * 画面上の日本語ラベルではなく、英語の value を API に送る点に注意。
   */
  const handleSave = async (id: number) => {
    setSavingId(id);
    setMessage('');
    setError('');

    const body = {
      status: draftStatus[id] ?? 'Pending',
      admin_comment: (draftComment[id] ?? '').trim() || null,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/samples/${id}/admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let detail = `保存に失敗しました (${res.status})`;
        try {
          const errBody = await res.json();
          if (typeof errBody?.detail === 'string') detail = errBody.detail;
        } catch {
          /* JSON でない応答なら上の detail を使う */
        }
        throw new Error(detail);
      }
      setMessage(`ID ${id} を保存しました。`);
      await loadSamples();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Administrator</h1>
        <Link href="/" className="text-sm text-gray-600 hover:underline">
          ← トップへ
        </Link>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        問い合わせの対応状況をラジオボタンで選び、必要ならコメントを付けて保存できます。
        新規登録時の初期ステータスは{' '}
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">
          未対応
        </span>{' '}
        です。一覧はキーワード・種別・対応状況・期間で絞り込めます。
        （色: 未対応=赤 / 一時対応済み=ピンク / 完全対応済み=色なし）
      </p>

      {/* ===== 検索フォーム（キーワード・種別・対応状況・期間） ===== */}
      <form onSubmit={handleSearch} className="mb-6 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2"
            placeholder="キーワードで検索（例: 白浜 パンダ郎）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="キーワード検索"
          />
          {/* 管理者は全種別を見るので、customer / stuff で絞り込み可能 */}
          <select
            className="rounded border border-gray-300 bg-white px-3 py-2"
            value={searchTroubleType}
            onChange={(e) => setSearchTroubleType(e.target.value)}
            aria-label="種別で絞り込み"
          >
            <option value="">すべての種別</option>
            <option value="customer">customer</option>
            <option value="stuff">stuff</option>
          </select>
          {/*
            対応状況のプルダウン検索。
            option の value は API 用の英語、表示テキストは日本語。
            空文字を選ぶと「すべての状況」＝ status クエリを付けない。
          */}
          <select
            className="rounded border border-gray-300 bg-white px-3 py-2"
            value={searchStatus}
            onChange={(e) => setSearchStatus(e.target.value)}
            aria-label="対応状況で絞り込み"
          >
            <option value="">すべての状況</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.labelJa}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="admin-date-from">
            期間
          </label>
          <input
            id="admin-date-from"
            type="date"
            className="rounded border border-gray-300 px-3 py-2"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="開始日"
          />
          <span className="text-sm text-gray-500">〜</span>
          <input
            id="admin-date-to"
            type="date"
            className="rounded border border-gray-300 px-3 py-2"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="終了日"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-900">
            検索
          </button>
          {hasActiveSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              クリア
            </button>
          )}
        </div>
      </form>

      {message && (
        <p className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {hasActiveSearch && (
        <p className="mb-3 text-sm text-gray-600">
          検索結果: {samples.length}件
          {appliedDateFrom || appliedDateTo
            ? `（期間: ${appliedDateFrom || '…'} 〜 ${appliedDateTo || '…'}）`
            : ''}
        </p>
      )}

      {samples.length === 0 ? (
        <p className="text-sm text-gray-500">
          {hasActiveSearch ? '一致するデータがありません。' : 'まだデータがありません。'}
        </p>
      ) : (
        <ul className="space-y-4">
          {samples.map((sample) => {
            const currentStatus = toSampleStatus(sample.status);
            return (
              <li key={sample.id} className="rounded border border-gray-200 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-bold">{sample.name}</span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    ID {sample.id}
                  </span>
                  {sample.trouble_type && (
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        sample.trouble_type === 'customer'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {sample.trouble_type}
                    </span>
                  )}
                  {/* 保存済みステータスを日本語＋色で表示 */}
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(currentStatus)}`}
                  >
                    {statusLabelJa(currentStatus)}
                  </span>
                </div>

                <p className="mb-1 text-sm text-gray-600">
                  日時: {new Date(sample.date).toLocaleString('ja-JP')} ／ 場所: {sample.place}
                </p>
                {sample.trouble_detail && (
                  <p className="mb-3 whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700">
                    {sample.trouble_detail}
                  </p>
                )}

                {/* ===== ステータス変更（ラジオ）。表示は日本語、value は英語 ===== */}
                <fieldset className="mb-3">
                  <legend className="mb-1 text-sm font-semibold text-gray-800">対応状況</legend>
                  <div className="flex flex-col gap-1.5">
                    {STATUS_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        {/*
                          name={`status-${sample.id}`} で行ごとにグループを分ける。
                          同じ name だと別の問い合わせのラジオと干渉してしまう。
                        */}
                        <input
                          type="radio"
                          name={`status-${sample.id}`}
                          value={opt.value}
                          checked={(draftStatus[sample.id] ?? 'Pending') === opt.value}
                          onChange={() =>
                            setDraftStatus((prev) => ({ ...prev, [sample.id]: opt.value }))
                          }
                        />
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(opt.value)}`}
                        >
                          {opt.labelJa}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* ===== 管理者コメント ===== */}
                <label className="mb-3 block text-sm">
                  <span className="mb-1 block font-semibold text-gray-800">管理者コメント</span>
                  <textarea
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    rows={3}
                    placeholder="対応メモがあれば入力（任意）"
                    value={draftComment[sample.id] ?? ''}
                    onChange={(e) =>
                      setDraftComment((prev) => ({ ...prev, [sample.id]: e.target.value }))
                    }
                  />
                </label>

                <button
                  type="button"
                  onClick={() => handleSave(sample.id)}
                  disabled={savingId === sample.id}
                  className="rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-900 disabled:opacity-60"
                >
                  {savingId === sample.id ? '保存中…' : 'この問い合わせを保存'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
