'use client';

import { useCallback, useEffect, useState } from 'react';

import type { components } from '@/types/api';

type Sample = components['schemas']['SampleResponse'];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export default function Home() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [place, setPlace] = useState('');
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const loadSamples = useCallback(async (search = appliedKeyword) => {
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set('q', search.trim());
    }
    const query = params.toString();
    const res = await fetch(`${API_BASE_URL}/samples${query ? `?${query}` : ''}`);
    setSamples(await res.json());
  }, [appliedKeyword]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedKeyword(keyword);
  };

  const handleClearSearch = () => {
    setKeyword('');
    setAppliedKeyword('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date || !place.trim()) return;
    const formattedDate = new Date(date).toISOString();
    await fetch(`${API_BASE_URL}/samples`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        date: formattedDate,
        place,
      }),
    });
    setName('');
    setDate('');
    setPlace('');
    loadSamples();
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_BASE_URL}/samples/${id}`, { method: 'DELETE' });
    loadSamples();
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Sample App</h1>

      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <input
          className="flex-1 rounded border border-gray-300 px-3 py-2"
          placeholder="キーワードで検索（例: 太郎 園）"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-label="キーワード検索"
        />
        <button type="submit" className="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-900">
          検索
        </button>
        {appliedKeyword && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            クリア
          </button>
        )}
      </form>

      <form onSubmit={handleCreate} className="mb-6 flex flex-col gap-2">
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
        <button type="submit" className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
          追加
        </button>
      </form>

      {appliedKeyword && (
        <p className="mb-3 text-sm text-gray-600">
          「{appliedKeyword}」の検索結果: {samples.length}件
        </p>
      )}

      {samples.length === 0 ? (
        <p className="text-sm text-gray-500">
          {appliedKeyword ? '一致するデータがありません。' : 'まだデータがありません。'}
        </p>
      ) : (
        <ul className="space-y-2">
          {samples.map((sample) => (
            <li
              key={sample.id}
              className="flex items-center justify-between rounded border border-gray-200 p-2"
            >
              <div className="flex flex-col">
                <span className="font-bold">{sample.name}</span>
                <span className="text-sm text-gray-600">
                  日時: {new Date(sample.date).toLocaleString('ja-JP')}
                </span>
                <span className="text-sm text-gray-600">場所: {sample.place}</span>
              </div>
              <button
                onClick={() => handleDelete(sample.id)}
                className="text-sm text-red-500 hover:underline"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
