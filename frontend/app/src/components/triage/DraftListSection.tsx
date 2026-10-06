'use client';

import type { FormEvent } from 'react';

import { btnBlack } from '@/lib/buttonStyles';
import type { DraftSample } from '@/types/samples';

/**
 * ホーム下部：一時保存一覧
 */

type DraftListSectionProps = {
  drafts: DraftSample[];
  draftKeyword: string;
  onDraftKeywordChange: (value: string) => void;
  onSearch: (e: FormEvent) => void;
  onOpenDraft: (draft: DraftSample) => void;
};

export default function DraftListSection({
  drafts,
  draftKeyword,
  onDraftKeywordChange,
  onSearch,
  onOpenDraft,
}: DraftListSectionProps) {
  return (
    <section className="mt-10 border-t border-gray-200 pt-8">
      <h2 className="mb-3 text-lg font-semibold">一時保存中のサンプル</h2>
      <p className="mb-3 text-xs text-gray-600">
        一時保存は最初の入力から2週間で自動削除されます。
      </p>
      <form onSubmit={onSearch} className="mb-4 flex gap-2">
        <input
          type="search"
          value={draftKeyword}
          onChange={(e) => onDraftKeywordChange(e.target.value)}
          placeholder="キーワードで検索"
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className={btnBlack}>
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
                onClick={() => onOpenDraft(draft)}
                className="w-full rounded border border-dashed border-gray-400 bg-amber-50/50 px-4 py-3 text-left text-sm hover:bg-amber-50"
              >
                <p className="text-xs text-gray-500">
                  {new Date(draft.date).toLocaleString('ja-JP')}
                </p>
                <p className="mt-1 font-medium text-gray-900">
                  報告者: {draft.name}
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
                  <p className="mt-1 text-xs text-gray-600">
                    エラー: {draft.error_code}
                  </p>
                )}
                <p className="mt-2 text-xs text-amber-800">
                  クリックして詳細を入力
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
