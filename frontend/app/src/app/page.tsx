'use client';

import { useCallback, useEffect, useState } from 'react';

import type { components } from '@/types/api';

type Sample = components['schemas']['SampleResponse'];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// ===== 追加: datetime-local 用に ISO 文字列を変換 =====
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// ===== 追加ここまで =====

export default function Home() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [place, setPlace] = useState('');
  const [troubleType, setTroubleType] = useState('');
  const [troubleDetail, setTroubleDetail] = useState('');

  // ===== 追加: 編集中のサンプル ID（null = 新規作成モード） =====
  const [editingId, setEditingId] = useState<number | null>(null);
  // ===== 追加ここまで =====

  const [keyword, setKeyword] = useState('');
  const [searchTroubleType, setSearchTroubleType] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [appliedTroubleType, setAppliedTroubleType] = useState('');

  const loadSamples = useCallback(async (search = appliedKeyword) => {
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set('q', search.trim());
    }
    if (appliedTroubleType) {
        params.set('trouble_type', appliedTroubleType); // 追加: クエリパラメータ送信
      }
    const query = params.toString();
    const res = await fetch(`${API_BASE_URL}/samples${query ? `?${query}` : ''}`);
    setSamples(await res.json());
  },[appliedKeyword, appliedTroubleType]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedKeyword(keyword);
    setAppliedTroubleType(searchTroubleType);
  };

  const handleClearSearch = () => {
    setKeyword('');
    setAppliedKeyword('');
    setSearchTroubleType('');
    setAppliedTroubleType('');
  };

  // ===== 追加: フォームをクリアして新規作成モードに戻す =====
  const resetForm = () => {
    setName('');
    setDate('');
    setPlace('');
    setTroubleType('');
    setTroubleDetail('');
    setEditingId(null);
  };
  // ===== 追加ここまで =====

  // ===== 追加: 一覧の「編集」→ フォームに値を載せる =====
  const handleStartEdit = (sample: Sample) => {
    setEditingId(sample.id);
    setName(sample.name);
    setDate(toDatetimeLocal(sample.date));
    setPlace(sample.place);
    setTroubleType(sample.trouble_type);
    setTroubleDetail(sample.trouble_detail);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // ===== 追加ここまで =====

  // ===== 変更: 新規作成 or PUT 更新を同じフォームで扱う =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date || !place.trim() || !troubleType.trim() || !troubleDetail.trim()) return;
    const formattedDate = new Date(date).toISOString();
    const body = {
      name,
      date: formattedDate,
      place,
      trouble_type: troubleType,
      trouble_detail: troubleDetail,
    };

    if (editingId !== null) {
      // PUT: 全項目を上書き更新
      await fetch(`${API_BASE_URL}/samples/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await fetch(`${API_BASE_URL}/samples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    resetForm();
    loadSamples();
  };
  // ===== 変更ここまで =====

  const handleDelete = async (id: number) => {
    await fetch(`${API_BASE_URL}/samples/${id}`, { method: 'DELETE' });
    // ===== 追加: 編集中の行を消したらフォームもリセット =====
    if (editingId === id) {
      resetForm();
    }
    // ===== 追加ここまで =====
    loadSamples();
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Sample App</h1>

      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-gray-300 px-3 py-2"
          placeholder="キーワードで検索（例: 白浜 パンダ郎）"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-label="キーワード検索"
        />
        <select
            className="rounded border border-gray-300 bg-white px-3 py-2"
            value={searchTroubleType}
            onChange={(e) => setSearchTroubleType(e.target.value)}
          >
            <option value="">すべての種別</option>
            <option value="customer">customer</option>
            <option value="stuff">stuff</option>
          </select>
        </div>
        <button type="submit" className="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-900">
          検索
        </button>
        {(appliedKeyword || appliedTroubleType) && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            クリア
          </button>
        )}
      </form>

      {/* ===== 変更: 作成/更新兼用フォーム ===== */}
      <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-2">
        {/* ===== 追加: 編集モード表示 ===== */}
        {editingId !== null && (
          <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ID {editingId} を編集中
          </p>
        )}
        {/* ===== 追加ここまで ===== */}
        <input
          className="rounded border border-gray-300 px-3 py-2"
          placeholder="名前を入力"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="datetime-local"
          className="rounded border border-gray-300 px-3 py-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <input
          className="rounded border border-gray-300 px-3 py-2"
          placeholder="場所を入力"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          required
        />
        {/* 追加: プルダウン (customer / stuff) */}
        <select
          className="rounded border border-gray-300 px-3 py-2 bg-white"
          value={troubleType}
          onChange={(e) => setTroubleType(e.target.value)}
        >
          <option value="">トラブル種別を選択</option>
          <option value="customer">customer</option>
          <option value="stuff">stuff</option>
        </select>
        <input
          className="rounded border border-gray-300 px-3 py-2"
          placeholder="トラブルの詳細を入力"
          value={troubleDetail}
          onChange={(e) => setTroubleDetail(e.target.value)}
          required
        />
        <div className="flex gap-2">
          <button type="submit" className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
            {editingId !== null ? '更新' : '追加'}
          </button>
          {/* ===== 追加: 編集キャンセル ===== */}
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              キャンセル
            </button>
          )}
          {/* ===== 追加ここまで ===== */}
        </div>
      </form>
      {/* ===== 変更ここまで ===== */}

      {appliedKeyword && (
        <p className="mb-3 text-sm text-gray-600">
          「{appliedKeyword}」の検索結果: {samples.length}件
        </p>
      )}

      {/* 一覧表示 */}
      {samples.length === 0 ? (
        <p className="text-sm text-gray-500">
          {appliedKeyword ? '一致するデータがありません。' : 'まだデータがありません。'}
        </p>
      ) : (
        <ul className="space-y-3">
          {samples.map((sample) => (
            <li
              key={sample.id}
              className={`flex flex-col gap-2 rounded border p-3 ${
                editingId === sample.id
                  ? 'border-amber-400 bg-amber-50/40'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{sample.name}</span>

                    {/* 追加: トラブル種別バッジ */}
                    {sample.trouble_type && (
                      <span
                       className={`rounded px-2 py-0.5 text-xs font-semibold ${
                         sample.trouble_type === 'customer'
                        ? 'bg-blue-100 text-blue-800'
                        : sample.trouble_type === 'stuff'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-800'
      }`}
    >
      {sample.trouble_type}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">
                    日時: {new Date(sample.date).toLocaleString('ja-JP')}
                  </span>
                  <span className="text-sm text-gray-600">場所: {sample.place}</span>
                </div>
                {/* ===== 追加: 編集ボタン + 削除 ===== */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(sample)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sample.id)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    削除
                  </button>
                </div>
                {/* ===== 追加ここまで ===== */}
              </div>

              {/* 追加: トラブル詳細テキスト表示 */}
              {sample.trouble_detail && (
                <div className="rounded bg-gray-50 p-2 text-xs text-gray-700 whitespace-pre-wrap">
                  <span className="font-semibold block text-gray-500 mb-0.5">【トラブル内容】</span>
                  {sample.trouble_detail}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
