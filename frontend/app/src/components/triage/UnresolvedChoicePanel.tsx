'use client';

import { btnBlack, btnBlue, btnWhite } from '@/lib/buttonStyles';

/**
 * 未解決時の分岐（一時保存 / 詳細入力）
 */

type UnresolvedChoicePanelProps = {
  actionError: string;
  submitting: boolean;
  onTemporarySave: () => void;
  onOpenDetail: () => void;
  onBack: () => void;
};

export default function UnresolvedChoicePanel({
  actionError,
  submitting,
  onTemporarySave,
  onOpenDetail,
  onBack,
}: UnresolvedChoicePanelProps) {
  return (
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
          onClick={onTemporarySave}
          className={btnWhite}
        >
          {submitting ? '保存中…' : '一時保存'}
        </button>
        <button type="button" onClick={onOpenDetail} className={btnBlue}>
          詳細を入力
        </button>
        <button type="button" onClick={onBack} className={btnBlack}>
          戻る
        </button>
      </div>
    </section>
  );
}
