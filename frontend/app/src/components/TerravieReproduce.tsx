'use client';

import { useState } from 'react';

type ScreenId = 'home' | 'ticket' | 'qr' | 'guest' | 'settings';

type LogEntry = {
  at: string;
  action: string;
};

type TerravieReproduceProps = {
  sampleId: number;
  sampleName: string;
  apiBaseUrl: string;
  onCompleted: () => void;
  onCancel: () => void;
};

function nowLabel(): string {
  return new Date().toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatLog(entries: LogEntry[]): string {
  return entries.map((e) => `[${e.at}] ${e.action}`).join('\n');
}

const SCREENS: { id: ScreenId; label: string }[] = [
  { id: 'home', label: 'ホーム' },
  { id: 'ticket', label: 'チケット確認' },
  { id: 'qr', label: 'QR読取' },
  { id: 'guest', label: 'ゲスト入場' },
  { id: 'settings', label: '端末設定' },
];

/**
 * 顧客問い合わせ用: アプリ内で Terravie 操作を再現し、
 * 「トラブル発生を通知」押下時点までの操作ログを保存する。
 * （実サイトは iframe 制限があるため、再現用モック画面を用意）
 */
export default function TerravieReproduce({
  sampleId,
  sampleName,
  apiBaseUrl,
  onCompleted,
  onCancel,
}: TerravieReproduceProps) {
  const [screen, setScreen] = useState<ScreenId>('home');
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    { at: nowLabel(), action: '再現セッション開始（モック: terravie.co.jp 相当）' },
    { at: nowLabel(), action: '画面表示: ホーム' },
  ]);
  const [qrInput, setQrInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pushLog = (action: string) => {
    setLogs((prev) => [...prev, { at: nowLabel(), action }]);
  };

  const goTo = (next: ScreenId) => {
    const label = SCREENS.find((s) => s.id === next)?.label ?? next;
    setScreen(next);
    pushLog(`画面遷移 → ${label}`);
  };

  const handleNotifyTrouble = async () => {
    setSubmitting(true);
    setError('');
    const withNotify = [
      ...logs,
      { at: nowLabel(), action: '【トラブル発生を通知】ボタン押下' },
    ];
    const operation_log = formatLog(withNotify);

    try {
      const res = await fetch(`${apiBaseUrl}/samples/${sampleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation_log }),
      });
      if (!res.ok) {
        throw new Error(`保存に失敗しました (${res.status})`);
      }
      onCompleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-emerald-700">
              TERRAVIE 再現モード（アプリ内）
            </p>
            <h2 className="text-lg font-bold text-gray-900">操作を再現してください</h2>
            <p className="text-sm text-gray-600">
              問い合わせ「{sampleName}」— 問題が起きた操作をこの画面で再現し、
              トラブル発生時に下のボタンで通知します。
            </p>
            <a
              href="https://terravie.co.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs text-blue-600 hover:underline"
            >
              参考: 実サイト terravie.co.jp（別タブ）
            </a>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            閉じる（ログ未保存）
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* モック本体 */}
          <div className="flex min-h-0 flex-1 flex-col border-b border-gray-200 md:border-b-0 md:border-r">
            <nav className="flex flex-wrap gap-1 border-b border-gray-200 bg-emerald-800 px-2 py-2">
              {SCREENS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(s.id)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    screen === s.id
                      ? 'bg-white text-emerald-900'
                      : 'text-emerald-50 hover:bg-emerald-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>

            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-emerald-50 to-white p-4">
              {screen === 'home' && (
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-emerald-900">Terravie 園館端末</h3>
                  <p className="text-sm text-gray-600">
                    入場・チケット確認などの操作を再現できます（デモ用モック）。
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        pushLog('ホーム: 「チケット確認を開く」をタップ');
                        goTo('ticket');
                      }}
                      className="rounded border border-emerald-200 bg-white px-3 py-4 text-left text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
                    >
                      チケット確認を開く
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pushLog('ホーム: 「QR読取を開始」をタップ');
                        goTo('qr');
                      }}
                      className="rounded border border-emerald-200 bg-white px-3 py-4 text-left text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
                    >
                      QR読取を開始
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pushLog('ホーム: 「ゲスト入場」をタップ');
                        goTo('guest');
                      }}
                      className="rounded border border-emerald-200 bg-white px-3 py-4 text-left text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
                    >
                      ゲスト入場
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pushLog('ホーム: 「端末設定」をタップ');
                        goTo('settings');
                      }}
                      className="rounded border border-emerald-200 bg-white px-3 py-4 text-left text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
                    >
                      端末設定
                    </button>
                  </div>
                </div>
              )}

              {screen === 'ticket' && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold">チケット確認</h3>
                  <p className="text-sm text-gray-600">券種・有効期限を確認する画面の再現です。</p>
                  <ul className="space-y-2 text-sm">
                    {['大人チケット', 'こどもチケット', '年間パス'].map((label) => (
                      <li key={label}>
                        <button
                          type="button"
                          onClick={() => pushLog(`チケット確認: 「${label}」を選択`)}
                          className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-left hover:bg-gray-50"
                        >
                          {label}を選択
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      pushLog('チケット確認: 「詳細を表示」をタップ');
                    }}
                    className="rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800"
                  >
                    詳細を表示
                  </button>
                </div>
              )}

              {screen === 'qr' && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold">QRコード読取</h3>
                  <p className="text-sm text-gray-600">
                    読み取れない・エラーになる操作をここで再現できます。
                  </p>
                  <input
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="QRコード値を入力（任意）"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    onBlur={() => {
                      if (qrInput.trim()) {
                        pushLog(`QR読取: 入力値「${qrInput.trim()}」を確定`);
                      }
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => pushLog('QR読取: 「スキャン開始」をタップ')}
                      className="rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800"
                    >
                      スキャン開始
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        pushLog('QR読取: 読取エラーを再現（タイムアウト）')
                      }
                      className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 hover:bg-red-100"
                    >
                      読取エラーを再現
                    </button>
                    <button
                      type="button"
                      onClick={() => pushLog('QR読取: 「再試行」をタップ')}
                      className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      再試行
                    </button>
                  </div>
                </div>
              )}

              {screen === 'guest' && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold">ゲスト入場</h3>
                  <p className="text-sm text-gray-600">入場ゲート操作の再現です。</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => pushLog('ゲスト入場: 「入場許可」をタップ')}
                      className="rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800"
                    >
                      入場許可
                    </button>
                    <button
                      type="button"
                      onClick={() => pushLog('ゲスト入場: 「入場拒否」をタップ')}
                      className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      入場拒否
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        pushLog('ゲスト入場: 「ゲート開閉エラー」を再現')
                      }
                      className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 hover:bg-red-100"
                    >
                      ゲート開閉エラーを再現
                    </button>
                  </div>
                </div>
              )}

              {screen === 'settings' && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold">端末設定</h3>
                  <p className="text-sm text-gray-600">ネットワーク・端末情報の確認操作です。</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => pushLog('端末設定: 「ネットワーク診断」を実行')}
                      className="rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800"
                    >
                      ネットワーク診断
                    </button>
                    <button
                      type="button"
                      onClick={() => pushLog('端末設定: 「端末再起動」をタップ')}
                      className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      端末再起動
                    </button>
                    <button
                      type="button"
                      onClick={() => pushLog('端末設定: 「ログ送信」をタップ')}
                      className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      ログ送信
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 操作ログプレビュー */}
          <aside className="flex h-48 flex-col md:h-auto md:w-64">
            <div className="border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500">
              記録中の操作ログ（{logs.length}件）
            </div>
            <pre className="flex-1 overflow-y-auto bg-gray-900 p-3 text-[11px] leading-relaxed text-green-300 whitespace-pre-wrap">
              {logs.length === 0
                ? '（まだ操作がありません）'
                : formatLog(logs)}
            </pre>
          </aside>
        </div>

        {/* トラブル発生通知 */}
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={submitting || logs.length === 0}
            onClick={handleNotifyTrouble}
            className="w-full rounded bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {submitting ? '送信中…' : 'トラブル発生を通知（ここまでの操作ログを保存）'}
          </button>
          <p className="mt-1 text-center text-xs text-gray-500">
            押した時点までの操作ログが問い合わせ ID {sampleId} に保存されます
          </p>
        </div>
      </div>
    </div>
  );
}
