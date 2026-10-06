'use client';

import { btnBlue, btnGreen } from '@/lib/buttonStyles';
import type { SimilarSample, TriageResult } from '@/types/samples';

import TriageReportFields from './TriageReportFields';

/**
 * トリアージ成功後の結果画面（一次回答・類似・再分析・解決/未解決）
 */

type TriageResultPanelProps = {
  triage: TriageResult;
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
  actionError: string;
  onOpenSimilar: (sample: SimilarSample) => void;
  onRerunTriage: () => void;
  onResolved: () => void;
  onUnresolved: () => void;
};

export default function TriageResultPanel({
  triage,
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
  actionError,
  onOpenSimilar,
  onRerunTriage,
  onResolved,
  onUnresolved,
}: TriageResultPanelProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onResolved} className={btnGreen}>
          解決済み
        </button>
        <button type="button" onClick={onUnresolved} className={btnBlue}>
          未解決
        </button>
      </div>
      <div className="rounded bg-gray-900 px-4 py-4 text-white">
        <h2 className="font-semibold text-white">AI 一次回答</h2>
        <p className="mt-2 whitespace-pre-wrap text-base text-white">
          {triage.initial_response}
        </p>
      </div>
      <div>
        <h2 className="mb-2 font-semibold">類似サンプル（完全対応済み）</h2>
        {triage.similar_samples.length === 0 ? (
          <p className="text-sm text-gray-600">
            類似する過去事例は見つかりませんでした。
          </p>
        ) : (
          <ul className="space-y-3">
            {triage.similar_samples.map((sample) => (
              <li key={sample.id}>
                <button
                  type="button"
                  onClick={() => onOpenSimilar(sample)}
                  className="w-full rounded border border-gray-200 px-3 py-3 text-left text-sm hover:border-gray-400 hover:bg-gray-50"
                >
                  <p className="font-medium">
                    #{sample.id} {sample.name}
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      クリックで詳細
                    </span>
                  </p>
                  {sample.expected_actions && (
                    <p className="mt-1 text-gray-700">{sample.expected_actions}</p>
                  )}
                  {sample.actual_actions && (
                    <p className="mt-1 text-gray-600">{sample.actual_actions}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {actionError && (
          <p className="mt-2 text-sm text-red-700">{actionError}</p>
        )}
      </div>
      <div className="flex flex-col gap-4 rounded border border-gray-200 bg-gray-50 px-4 py-4">
        <h2 className="font-semibold">報告内容（編集可）</h2>
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
          inputClassName="rounded border border-gray-300 bg-white px-3 py-2"
          idleButtonLabel="再度 AI 一次回答を取得"
          buttonType="button"
          onButtonClick={onRerunTriage}
        />
      </div>
    </section>
  );
}
