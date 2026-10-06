'use client';

import type { FormEvent } from 'react';

import type { TriageResult } from '@/types/samples';

import TriageReportFields from './TriageReportFields';

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
        <TriageReportFields
          name={name}
          onNameChange={onNameChange}
          expectedActions={expectedActions}
          onExpectedChange={onExpectedChange}
          actualActions={actualActions}
          onActualChange={onActualChange}
          errorCode={errorCode}
          onErrorCodeChange={onErrorCodeChange}
          triageError={triageError}
          analyzing={analyzing}
          inputClassName="rounded border border-gray-300 px-3 py-2"
          idleButtonLabel="AI で類似事例・一次回答を取得"
          buttonType="submit"
        />
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
