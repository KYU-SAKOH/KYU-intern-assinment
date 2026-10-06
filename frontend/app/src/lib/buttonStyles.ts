/**
 * ボタン色トークン（UIぼたんの色.csv）
 * 青=進む系 / 黒=戻る系 / 赤=キャンセル・削除 / 緑=登録・解決 / 白=一時保存
 */

const base =
  'inline-flex items-center justify-center rounded px-4 py-2 text-sm font-semibold disabled:opacity-60';

export const btnBlue = `${base} bg-blue-600 text-white hover:bg-blue-700`;
export const btnBlack = `${base} bg-gray-900 text-white hover:bg-gray-800`;
export const btnRed = `${base} bg-red-600 text-white hover:bg-red-700`;
export const btnGreen = `${base} bg-green-600 text-white hover:bg-green-700`;
export const btnWhite = `${base} border border-gray-400 bg-white text-gray-900 hover:bg-gray-50`;
