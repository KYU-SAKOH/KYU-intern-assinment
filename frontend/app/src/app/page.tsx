'use client';

import { useCallback, useEffect, useState } from 'react';

import TerravieReproduce from '@/components/TerravieReproduce';
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

  // ===== 追加: 顧客向け Terravie 再現セッション =====
  const [reproduceTarget, setReproduceTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  // ===== 追加ここまで =====

  // ===== 追加: 必須5項目の未入力通知 =====
  const [formError, setFormError] = useState('');
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());
  // ===== 追加ここまで =====

  const [keyword, setKeyword] = useState('');
  const [searchTroubleType, setSearchTroubleType] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [appliedTroubleType, setAppliedTroubleType] = useState('');
  // ===== 追加: 日付フィルタ（入力中 / 適用済み） =====
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  // ===== 追加ここまで =====

  const loadSamples = useCallback(async (search = appliedKeyword) => {
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set('q', search.trim());
    }
    if (appliedTroubleType) {
        params.set('trouble_type', appliedTroubleType); // 追加: クエリパラメータ送信
      }
    // ===== 追加: 日付レンジをクエリに載せる =====
    if (appliedDateFrom) {
      params.set('date_from', appliedDateFrom);
    }
    if (appliedDateTo) {
      params.set('date_to', appliedDateTo);
    }
    // ===== 追加ここまで =====
    const query = params.toString();
    const res = await fetch(`${API_BASE_URL}/samples${query ? `?${query}` : ''}`);
    setSamples(await res.json());
  },[appliedKeyword, appliedTroubleType, appliedDateFrom, appliedDateTo]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedKeyword(keyword);
    setAppliedTroubleType(searchTroubleType);
    // ===== 追加: 日付フィルタを適用 =====
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    // ===== 追加ここまで =====
  };

  const handleClearSearch = () => {
    setKeyword('');
    setAppliedKeyword('');
    setSearchTroubleType('');
    setAppliedTroubleType('');
    // ===== 追加: 日付フィルタもクリア =====
    setDateFrom('');
    setDateTo('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
    // ===== 追加ここまで =====
  };

  // ===== 追加: フォームをクリアして新規作成モードに戻す =====
  const resetForm = () => {
    setName('');
    setDate('');
    setPlace('');
    setTroubleType('');
    setTroubleDetail('');
    setEditingId(null);
    setFormError('');
    setMissingFields(new Set());
  };
  // ===== 追加ここまで =====

  // ===== 追加: 必須5項目の欠落チェック =====
  const getMissingRequiredFields = () => {
    const missing: { key: string; label: string }[] = [];
    if (!name.trim()) missing.push({ key: 'name', label: '名前' });
    if (!date) missing.push({ key: 'date', label: '日時' });
    if (!place.trim()) missing.push({ key: 'place', label: '場所' });
    if (!troubleType.trim()) missing.push({ key: 'troubleType', label: 'トラブル種別' });
    if (!troubleDetail.trim()) missing.push({ key: 'troubleDetail', label: 'トラブルの詳細' });
    return missing;
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
    setFormError('');
    setMissingFields(new Set());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // ===== 追加ここまで =====

  // ===== 変更: 新規作成 or PUT 更新を同じフォームで扱う =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missing = getMissingRequiredFields();
    if (missing.length > 0) {
      const labels = missing.map((m) => m.label).join('・');
      setMissingFields(new Set(missing.map((m) => m.key)));
      setFormError(
        editingId !== null
          ? `必須項目（${labels}）が未入力のため、更新できません。5項目すべて入力してください。`
          : `必須項目（${labels}）が未入力のため、追加できません。5項目すべて入力してください。`,
      );
      return;
    }
    setFormError('');
    setMissingFields(new Set());

    // datetime-local 値を安全に ISO へ（不正だと toISOString が落ちてモックまで到達しない）
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      setMissingFields(new Set(['date']));
      setFormError('日時の形式が正しくありません。もう一度選び直してください。追加できません。');
      return;
    }
    const formattedDate = parsedDate.toISOString();

    // 編集時は既存の操作ログを消さないよう引き継ぐ
    const existingLog =
      editingId !== null
        ? samples.find((s) => s.id === editingId)?.operation_log ?? null
        : null;
    const body = {
      name,
      date: formattedDate,
      place,
      trouble_type: troubleType,
      trouble_detail: troubleDetail,
      operation_log: existingLog,
    };

    // リセット前に種別を保持（customer なら直後に再現モックを開く）
    const shouldReproduce = troubleType === 'customer';

    try {
      if (editingId !== null) {
        const res = await fetch(`${API_BASE_URL}/samples/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(`更新に失敗しました (${res.status})`);
        }
        resetForm();
        await loadSamples();
      } else {
        const res = await fetch(`${API_BASE_URL}/samples`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(`追加に失敗しました (${res.status})`);
        }
        const created: Sample = await res.json();
        resetForm();
        // 一覧更新より先にモックを開く（await 失敗で開かない事故を防ぐ）
        if (shouldReproduce && created?.id != null) {
          setReproduceTarget({ id: created.id, name: created.name });
        }
        await loadSamples();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存に失敗しました');
    }
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
      {/* ===== 追加: 顧客向け再現オーバーレイ ===== */}
      {reproduceTarget && (
        <TerravieReproduce
          sampleId={reproduceTarget.id}
          sampleName={reproduceTarget.name}
          apiBaseUrl={API_BASE_URL}
          onCompleted={() => {
            setReproduceTarget(null);
            loadSamples();
          }}
          onCancel={() => setReproduceTarget(null)}
        />
      )}
      {/* ===== 追加ここまで ===== */}

      <h1 className="mb-6 text-2xl font-bold">Sample App</h1>
      <p className="mb-4 text-sm text-gray-600">
        種別が <span className="font-semibold">customer</span> の問い合わせを追加すると、
        アプリ内で Terravie 操作を再現し「トラブル発生を通知」できます。
      </p>

      <form onSubmit={handleSearch} className="mb-6 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
        <input
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2"
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
        {/* ===== 追加: 日付レンジフィルタ UI ===== */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="date-from">
            期間
          </label>
          <input
            id="date-from"
            type="date"
            className="rounded border border-gray-300 px-3 py-2"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="開始日"
          />
          <span className="text-sm text-gray-500">〜</span>
          <input
            id="date-to"
            type="date"
            className="rounded border border-gray-300 px-3 py-2"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="終了日"
          />
        </div>
        {/* ===== 追加ここまで ===== */}
        <div className="flex gap-2">
        <button type="submit" className="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-900">
          検索
        </button>
        {(appliedKeyword || appliedTroubleType || appliedDateFrom || appliedDateTo) && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            クリア
          </button>
        )}
        </div>
      </form>

      {/* ===== 変更: 作成/更新兼用フォーム ===== */}
      <form onSubmit={handleSubmit} noValidate className="mb-6 flex flex-col gap-2">
        {/* ===== 追加: 編集モード表示 ===== */}
        {editingId !== null && (
          <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ID {editingId} を編集中
          </p>
        )}
        {/* ===== 追加ここまで ===== */}

        {/* ===== 追加: 必須未入力の明確な通知 ===== */}
        {formError && (
          <div
            role="alert"
            className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
          >
            {formError}
          </div>
        )}
        <p className="text-xs text-gray-500">
          必須5項目: 名前・日時・場所・トラブル種別・トラブルの詳細
        </p>
        {/* ===== 追加ここまで ===== */}

        <input
          className={`rounded border px-3 py-2 ${
            missingFields.has('name') ? 'border-red-500 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="名前を入力（必須）"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (formError) setFormError('');
            setMissingFields((prev) => {
              const next = new Set(prev);
              next.delete('name');
              return next;
            });
          }}
          aria-invalid={missingFields.has('name')}
          aria-required="true"
        />
        <input
          type="datetime-local"
          className={`rounded border px-3 py-2 ${
            missingFields.has('date') ? 'border-red-500 bg-red-50' : 'border-gray-300'
          }`}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            if (formError) setFormError('');
            setMissingFields((prev) => {
              const next = new Set(prev);
              next.delete('date');
              return next;
            });
          }}
          aria-label="日時（必須）"
          aria-invalid={missingFields.has('date')}
          aria-required="true"
        />
        <input
          className={`rounded border px-3 py-2 ${
            missingFields.has('place') ? 'border-red-500 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="場所を入力（必須）"
          value={place}
          onChange={(e) => {
            setPlace(e.target.value);
            if (formError) setFormError('');
            setMissingFields((prev) => {
              const next = new Set(prev);
              next.delete('place');
              return next;
            });
          }}
          aria-invalid={missingFields.has('place')}
          aria-required="true"
        />
        {/* 追加: プルダウン (customer / stuff) */}
        <select
          className={`rounded border px-3 py-2 bg-white ${
            missingFields.has('troubleType') ? 'border-red-500 bg-red-50' : 'border-gray-300'
          }`}
          value={troubleType}
          onChange={(e) => {
            setTroubleType(e.target.value);
            if (formError) setFormError('');
            setMissingFields((prev) => {
              const next = new Set(prev);
              next.delete('troubleType');
              return next;
            });
          }}
          aria-label="トラブル種別（必須）"
          aria-invalid={missingFields.has('troubleType')}
          aria-required="true"
        >
          <option value="">トラブル種別を選択（必須）</option>
          <option value="customer">customer</option>
          <option value="stuff">stuff</option>
        </select>
        <input
          className={`rounded border px-3 py-2 ${
            missingFields.has('troubleDetail') ? 'border-red-500 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="トラブルの詳細を入力（必須）"
          value={troubleDetail}
          onChange={(e) => {
            setTroubleDetail(e.target.value);
            if (formError) setFormError('');
            setMissingFields((prev) => {
              const next = new Set(prev);
              next.delete('troubleDetail');
              return next;
            });
          }}
          aria-invalid={missingFields.has('troubleDetail')}
          aria-required="true"
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

      {/* ===== 変更: 日付フィルタも含めた検索結果表示 ===== */}
      {(appliedKeyword || appliedTroubleType || appliedDateFrom || appliedDateTo) && (
        <p className="mb-3 text-sm text-gray-600">
          検索結果: {samples.length}件
          {appliedDateFrom || appliedDateTo
            ? `（期間: ${appliedDateFrom || '…'} 〜 ${appliedDateTo || '…'}）`
            : ''}
        </p>
      )}
      {/* ===== 変更ここまで ===== */}

      {/* 一覧表示 */}
      {samples.length === 0 ? (
        <p className="text-sm text-gray-500">
          {appliedKeyword || appliedTroubleType || appliedDateFrom || appliedDateTo
            ? '一致するデータがありません。'
            : 'まだデータがありません。'}
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
                <div className="flex flex-col items-end gap-2">
                  {sample.trouble_type === 'customer' && (
                    <button
                      type="button"
                      onClick={() =>
                        setReproduceTarget({ id: sample.id, name: sample.name })
                      }
                      className="text-sm text-emerald-700 hover:underline"
                    >
                      再現を記録
                    </button>
                  )}
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

              {/* ===== 追加: 操作ログ表示 ===== */}
              {sample.operation_log && (
                <div className="rounded border border-emerald-100 bg-emerald-50/60 p-2 text-xs text-gray-800 whitespace-pre-wrap">
                  <span className="mb-0.5 block font-semibold text-emerald-800">
                    【操作ログ（トラブル発生通知まで）】
                  </span>
                  {sample.operation_log}
                </div>
              )}
              {/* ===== 追加ここまで ===== */}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
