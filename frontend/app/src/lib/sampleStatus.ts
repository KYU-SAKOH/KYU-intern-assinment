/**
 * 問い合わせの対応状況（status）まわりの共通ヘルパー
 *
 * DB / API では英語（Pending など）で保存し、
 * 画面では日本語＋色付きバッジで見せる、という分担にしている。
 *
 * 色のルール（管理者の要望）:
 *  - 未対応 (Pending)             → 赤
 *  - 一時対応済み (Temporarily…)  → ピンク
 *  - 完全対応済み (Fully…)        → 色なし（none）
 */

/** API・DB に保存する値（この3つ以外は送らない） */
export type SampleStatus = 'Pending' | 'Temporarily Resolved' | 'Fully Resolved';

/** ラジオボタンや選択肢の定義（value は英語、labelJa は表示用） */
export const STATUS_OPTIONS: { value: SampleStatus; labelJa: string }[] = [
  { value: 'Pending', labelJa: '未対応' },
  { value: 'Temporarily Resolved', labelJa: '一時対応済み' },
  { value: 'Fully Resolved', labelJa: '完全対応済み' },
];

/** 英語の status → 日本語ラベル。未知の値は「未対応」扱い */
export function statusLabelJa(status: string | null | undefined): string {
  const found = STATUS_OPTIONS.find((o) => o.value === status);
  return found?.labelJa ?? '未対応';
}

/**
 * ステータスバッジ用の Tailwind クラス
 *  - 未対応: 赤
 *  - 一時対応済み: ピンク
 *  - 完全対応済み: 色なし（背景なし・通常の文字色）
 */
export function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'Pending':
      return 'bg-red-100 text-red-800';
    case 'Temporarily Resolved':
      return 'bg-pink-100 text-pink-800';
    case 'Fully Resolved':
      // none: 背景色を付けない（枠線だけ薄いグレーで「バッジ感」は残す）
      return 'border border-gray-300 bg-transparent text-gray-800';
    default:
      return 'bg-red-100 text-red-800';
  }
}

/** API から来た値を安全に SampleStatus へ（無ければ Pending） */
export function toSampleStatus(status: string | null | undefined): SampleStatus {
  if (
    status === 'Pending' ||
    status === 'Temporarily Resolved' ||
    status === 'Fully Resolved'
  ) {
    return status;
  }
  return 'Pending';
}
