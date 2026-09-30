'use client';

import type { FormEvent } from 'react';

import type { TriageResult } from '@/types/samples';

/**
 * トップのトリアージ入力フォーム（view === home）
 */

type TriageInputPanelProps = {
  name: string;
  onNameChange: (value: string) => void;
  expectedActions: string;
  onExpectedChange: (value: string) => void;
  actualActions: string;
  onActualChange: (value: string) => void;
  errorCode: string;
  onErrorCodeChange: (value: string) => void;
  triageError: string;
  analyzing: boolean;
  triage: TriageResult | null;
  onSubmit: (e: FormEvent) => void;
};

export default function TriageInputPanel({
  name,
  onNameChange,
  expectedActions,
  onExpectedChange,
  actualActions,
  onActualChange,
  errorCode,
  onErrorCodeChange,
  triageError,
  analyzing,
  triage,
  onSubmit,
}: TriageInputPanelProps) {
  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">
            報告者名 <span className="text-red-600">*</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">
            実施した操作と期待結果 <span className="text-red-600">*</span>
          </span>
          <textarea
            value={expectedActions}
            onChange={(e) => onExpectedChange(e.target.value)}
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
            onChange={(e) => onActualChange(e.target.value)}
            rows={4}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">エラーコード（任意）</span>
          <input
            type="text"
            value={errorCode}
            onChange={(e) => onErrorCodeChange(e.target.value)}
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
  );
}
