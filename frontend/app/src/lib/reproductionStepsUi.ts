/**
 * 再現手順ウィザード用の表示ヘルパー・ラベル
 *
 * DetailWizard（新規登録・編集）で共通利用する。
 */

export const REPRODUCTION_RATE_LABELS: Record<string, string> = {
  always: 'いつも再現する',
  often: 'よく再現する',
  sometimes: 'ときどき再現する',
  rare: 'まれに再現する',
};

export const SEVERITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

/** 既存手順が最低件数を満たしていれば、編集開始時に「合格扱い」してよい */
export function stepsLookApproved(steps: string[]): boolean {
  const cleaned = steps.map((s) => s.trim()).filter(Boolean);
  return cleaned.length >= 3;
}

export function stepRowLabel(index: number, total: number): string {
  if (index === 0) return '開始';
  if (total >= 2 && index === total - 1) return '結果・現場対応';
  return `${index + 1}.`;
}

export function stepRowPlaceholder(index: number, total: number): string {
  if (index === 0) return '例: ゲート端末のアプリを開く';
  if (total >= 2 && index === total - 1) {
    return '例: 「読み取れません」と出た。レンズを拭いて再スキャンしたが改善せず';
  }
  return '例: QRコードをかざす';
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
