/**
 * バックエンド API 呼び出しの共通ヘルパー
 *
 * 各画面で同じ定数・エラー解釈をコピーしないための置き場。
 * フロントは素の fetch で API_BASE_URL 配下を叩く。
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

/** FastAPI の detail（文字列 or バリデーション配列）を読みやすい一文にする */
export async function readApiError(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string') return data.detail;
    if (Array.isArray(data?.detail)) {
      return (
        data.detail
          .map((d: { msg?: string }) => d.msg)
          .filter(Boolean)
          .join(' / ') || fallback
      );
    }
  } catch {
    /* ignore */
  }
  return fallback;
}
