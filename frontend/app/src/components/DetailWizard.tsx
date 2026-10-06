'use client';

import type { FormEvent, ReactNode } from 'react';

import {
  REPRODUCTION_RATE_LABELS,
  SEVERITY_LABELS,
  stepRowLabel,
  stepRowPlaceholder,
} from '@/lib/reproductionStepsUi';

/**
 * 詳細入力の 3 ステップウィザード（新規登録・登録済み編集で共通）
 *
 * step1 の中身（場所・メールなど）は親が step1Content で渡す。
 * step2（再現手順＋AIチェック）と step3（追加情報）の UI はここで共通化している。
 */

export type DetailStep = 1 | 2 | 3;

type DetailWizardProps = {
  detailStep: DetailStep;
  onSelectStep: (step: DetailStep) => void;
  stepTabLabels: [string, string, string];
  title: ReactNode;
  preamble?: ReactNode;
  step1Content: ReactNode;
  reproductionSteps: string[];
  onUpdateStep: (index: number, value: string) => void;
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
  onMoveStep: (index: number, direction: -1 | 1) => void;
  onAppendSuggestedStep: (text: string) => void;
  assistLoading: boolean;
  assistError: string;
  gapWarnings: string[];
  suggestedNextSteps: string[];
  stepsAiApproved: boolean;
  onRunAssist: () => void;
  reproductionRate: string;
  onReproductionRateChange: (value: string) => void;
  severity: string;
  onSeverityChange: (value: string) => void;
  screenshotPath: string;
  uploadingScreenshot: boolean;
  onScreenshotFile: (file: File | null) => void;
  deviceInfo: string;
  onDeviceInfoChange: (value: string) => void;
  actionError: string;
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  onBack: () => void;
  onFormSubmit: (e: FormEvent) => void;
  footerExtra?: ReactNode;
};

export default function DetailWizard({
  detailStep,
  onSelectStep,
  stepTabLabels,
  title,
  preamble,
  step1Content,
  reproductionSteps,
  onUpdateStep,
  onAddStep,
  onRemoveStep,
  onMoveStep,
  onAppendSuggestedStep,
  assistLoading,
  assistError,
  gapWarnings,
  suggestedNextSteps,
  stepsAiApproved,
  onRunAssist,
  reproductionRate,
  onReproductionRateChange,
  severity,
  onSeverityChange,
  screenshotPath,
  uploadingScreenshot,
  onScreenshotFile,
  deviceInfo,
  onDeviceInfoChange,
  actionError,
  submitting,
  submitLabel,
  submittingLabel,
  onBack,
  onFormSubmit,
  footerExtra,
}: DetailWizardProps) {
  return (
    <section className="space-y-4">
      {preamble}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {([1, 2, 3] as const).map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onSelectStep(step)}
            className={`rounded px-3 py-1.5 font-medium ${
              detailStep === step
                ? 'bg-gray-900 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {stepTabLabels[step - 1]}
          </button>
        ))}
      </div>

      <form onSubmit={onFormSubmit} className="flex flex-col gap-3 text-sm">
        <h2 className="font-semibold">
          {title}
          <span className="ml-2 font-normal text-gray-500">
            （{detailStep} / 3）
          </span>
        </h2>

        {detailStep === 1 && step1Content}

        {detailStep === 2 && (
          <>
            <p className="text-xs text-gray-600">
              操作を時系列で書いてください（最低3件・最大15件）。
              1行目はきっかけの操作、最後の行は結果と現場で試した対応まで書いてください。
              AIが不足があれば指摘します。軽い指摘があっても、内容が追えると判断されれば次へ進めます。
            </p>
            <ul className="space-y-2">
              {reproductionSteps.map((stepText, index) => (
                <li
                  key={index}
                  className="flex flex-wrap items-start gap-2 sm:flex-nowrap"
                >
                  <span
                    className={`mt-2 shrink-0 text-xs font-semibold ${
                      index === 0 || index === reproductionSteps.length - 1
                        ? 'w-28 text-gray-800'
                        : 'w-8 text-gray-500'
                    }`}
                  >
                    {stepRowLabel(index, reproductionSteps.length)}
                  </span>
                  <input
                    type="text"
                    value={stepText}
                    onChange={(e) => onUpdateStep(index, e.target.value)}
                    placeholder={stepRowPlaceholder(
                      index,
                      reproductionSteps.length,
                    )}
                    className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2"
                  />
                  <div className="flex shrink-0 items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => onMoveStep(index, -1)}
                      disabled={index === 0}
                      className="text-xs text-gray-700 underline disabled:opacity-40"
                    >
                      上へ
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveStep(index, 1)}
                      disabled={index === reproductionSteps.length - 1}
                      className="text-xs text-gray-700 underline disabled:opacity-40"
                    >
                      下へ
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveStep(index)}
                      disabled={reproductionSteps.length <= 1}
                      className="text-xs text-red-700 underline disabled:opacity-40"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onAddStep}
                disabled={reproductionSteps.length >= 15}
                className="rounded border border-gray-400 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                手順を追加
              </button>
              <button
                type="button"
                onClick={onRunAssist}
                disabled={assistLoading}
                className="rounded bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {assistLoading ? 'AIチェック中…' : 'AIにチェックしてもらう'}
              </button>
            </div>
            {assistError && (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {assistError}
              </p>
            )}
            {gapWarnings.length > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="font-semibold text-amber-950">指摘</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-950">
                  {gapWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {suggestedNextSteps.length > 0 && (
              <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="font-semibold text-gray-800">
                  次の操作候補（クリックで追加）
                </p>
                <ul className="mt-2 space-y-1">
                  {suggestedNextSteps.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => onAppendSuggestedStep(s)}
                        className="text-left text-gray-800 underline hover:text-gray-950"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stepsAiApproved && (
              <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                AIチェック合格。次へ進めます。
              </p>
            )}
          </>
        )}

        {detailStep === 3 && (
          <>
            <p className="text-xs text-gray-600">わかれば入力（すべて任意）</p>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">再現率</span>
              <select
                value={reproductionRate}
                onChange={(e) => onReproductionRateChange(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2"
              >
                <option value="">未選択</option>
                {Object.entries(REPRODUCTION_RATE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">重要度</span>
              <select
                value={severity}
                onChange={(e) => onSeverityChange(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2"
              >
                <option value="">未選択</option>
                {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">スクリーンショット</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  onScreenshotFile(file);
                }}
                className="rounded border border-gray-300 px-3 py-2"
              />
              {uploadingScreenshot && (
                <span className="text-xs text-gray-500">アップロード中…</span>
              )}
              {screenshotPath && (
                <span className="text-xs text-emerald-700">
                  添付済み: {screenshotPath}
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">端末情報</span>
              <textarea
                value={deviceInfo}
                onChange={(e) => onDeviceInfoChange(e.target.value)}
                rows={3}
                placeholder="機種名・OS・アプリバージョンなど"
                className="rounded border border-gray-300 px-3 py-2"
              />
            </label>
          </>
        )}

        {actionError && <p className="text-sm text-red-700">{actionError}</p>}

        <div className="mt-2 flex flex-wrap gap-3">
          {detailStep > 1 && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-12 items-center rounded-lg bg-sky-600 px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-sky-700"
            >
              戻る
            </button>
          )}
          {detailStep < 3 ? (
            <button
              type="submit"
              disabled={detailStep === 2 && !stepsAiApproved}
              className="rounded bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              次へ
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {submitting ? submittingLabel : submitLabel}
            </button>
          )}
          {footerExtra}
        </div>
      </form>
    </section>
  );
}
