'use client';

import type { FormEvent } from 'react';

import { btnBlack, btnWhite } from '@/lib/buttonStyles';
import {
  STATUS_OPTIONS,
  canEditRegisteredStatus,
  statusBadgeClass,
  statusLabelJa,
} from '@/lib/sampleStatus';
import type { RegisteredSample } from '@/types/samples';

/**
 * ホーム下部：登録済み一覧と検索
 *
 * 管理者からの未読通知がある件は上部に寄せられ（サーバ側ソート）、
 * オレンジ系の強調表示で目立たせる。
 */

type RegisteredListSectionProps = {
  registered: RegisteredSample[];
  registeredKeyword: string;
  onKeywordChange: (value: string) => void;
  registeredEmail: string;
  onEmailChange: (value: string) => void;
  registeredStatus: string;
  onStatusChange: (value: string) => void;
  registeredDateFrom: string;
  onDateFromChange: (value: string) => void;
  registeredDateTo: string;
  onDateToChange: (value: string) => void;
  onSearch: (e: FormEvent) => void;
  onClear: () => void;
  onOpenSample: (sample: RegisteredSample) => void;
  onRefresh?: () => void;
};

export default function RegisteredListSection({
  registered,
  registeredKeyword,
  onKeywordChange,
  registeredEmail,
  onEmailChange,
  registeredStatus,
  onStatusChange,
  registeredDateFrom,
  onDateFromChange,
  registeredDateTo,
  onDateToChange,
  onSearch,
  onClear,
  onOpenSample,
  onRefresh,
}: RegisteredListSectionProps) {
  const unreadItems = registered.filter((s) => s.staff_notify_unread);
  const unreadCount = unreadItems.length;

  return (
    <section id="registered-samples" className="mt-10 border-t border-gray-200 pt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">登録済みサンプル</h2>
        {onRefresh && (
          <button type="button" onClick={onRefresh} className={btnWhite}>
            一覧を更新
          </button>
        )}
      </div>

      {unreadCount > 0 && (
        <div className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-100 px-4 py-3">
          <p className="text-base font-bold text-amber-950">
            管理者からの更新が {unreadCount} 件あります
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-950">
            {unreadItems.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onOpenSample(s)}
                  className="font-semibold underline hover:text-amber-800"
                >
                  #{s.id}
                  {s.staff_notify_summary
                    ? ` — ${s.staff_notify_summary}`
                    : ' — 更新あり'}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-900">
            詳細を開き、画面の案内に従って未読を消してください。
          </p>
        </div>
      )}

      <p className="mb-3 text-xs text-gray-600">
        更新がある件はオレンジで強調されます。メールで絞り込むと自分の件だけに絞れます。
      </p>
      <form onSubmit={onSearch} className="mb-4 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            value={registeredKeyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="キーワードで検索"
            className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={registeredEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="登録時メールで絞り込み"
            className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={registeredStatus}
            onChange={(e) => onStatusChange(e.target.value)}
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
            onChange={(e) => onDateFromChange(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="text-sm text-gray-500">〜</span>
          <input
            id="reg-date-to"
            type="date"
            value={registeredDateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="submit" className={btnBlack}>
            検索
          </button>
          <button type="button" onClick={onClear} className={btnWhite}>
            クリア
          </button>
        </div>
      </form>
      {registered.length === 0 ? (
        <p className="text-sm text-gray-600">登録済みサンプルはありません。</p>
      ) : (
        <ul className="space-y-3">
          {registered.map((sample) => {
            const unread = Boolean(sample.staff_notify_unread);
            return (
              <li key={sample.id}>
                <button
                  type="button"
                  onClick={() => onOpenSample(sample)}
                  className={
                    unread
                      ? 'w-full rounded-lg border-l-8 border-amber-500 border-y-2 border-r-2 border-y-amber-400 border-r-amber-400 bg-amber-50 px-4 py-4 text-left text-sm shadow-md ring-2 ring-amber-200 hover:bg-amber-100'
                      : 'w-full rounded border border-gray-200 bg-white px-4 py-3 text-left text-sm shadow-sm hover:bg-gray-50'
                  }
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">#{sample.id}</span>
                    {unread && (
                      <span className="rounded bg-amber-600 px-2.5 py-1 text-xs font-bold tracking-wide text-white">
                        更新あり
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(sample.status)}`}
                    >
                      ステータス: {statusLabelJa(sample.status)}
                    </span>
                  </div>
                  {unread && sample.staff_notify_summary && (
                    <p className="mb-2 text-base font-bold text-amber-950">
                      {sample.staff_notify_summary}
                    </p>
                  )}
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
            );
          })}
        </ul>
      )}
    </section>
  );
}
