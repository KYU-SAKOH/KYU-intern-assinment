'use client';

/**
 * トリアージの報告欄（報告者名・期待結果・実際の結果・エラーコード）
 *
 * 入力画面はフォーム送信、結果画面はボタン再分析。背景色とボタン文言だけ分ける。
 */

type TriageReportFieldsProps = {
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
  inputClassName: string;
  idleButtonLabel: string;
  buttonType: 'submit' | 'button';
  onButtonClick?: () => void;
};

export default function TriageReportFields({
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
  inputClassName,
  idleButtonLabel,
  buttonType,
  onButtonClick,
}: TriageReportFieldsProps) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">
          報告者名 <span className="text-red-600">*</span>
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={inputClassName}
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
          className={inputClassName}
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
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">エラーコード（任意）</span>
        <input
          type="text"
          value={errorCode}
          onChange={(e) => onErrorCodeChange(e.target.value)}
          className={inputClassName}
        />
      </label>
      {triageError && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {triageError}
        </p>
      )}
      <button
        type={buttonType}
        disabled={analyzing}
        onClick={onButtonClick}
        className="rounded bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
      >
        {analyzing ? 'AI 分析中…' : idleButtonLabel}
      </button>
    </>
  );
}
