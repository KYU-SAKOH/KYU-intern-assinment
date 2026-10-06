'use client';

import { btnBlack, btnRed } from '@/lib/buttonStyles';

/**
 * 削除確認モーダル
 * 削除=赤 / キャンセル=黒（この画面のキャンセルは「戻る」扱い）
 */

type DeleteConfirmDialogProps = {
  open: boolean;
  message: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DeleteConfirmDialog({
  open,
  message,
  confirming = false,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="presentation"
      onClick={confirming ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        className="w-full max-w-sm rounded-lg bg-white px-5 py-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="delete-confirm-title" className="text-sm text-gray-900">
          {message}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className={btnRed}
          >
            {confirming ? '削除中…' : '削除'}
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className={btnBlack}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
