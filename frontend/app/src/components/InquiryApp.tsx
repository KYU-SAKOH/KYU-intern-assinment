'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import TerravieReproduce from '@/components/TerravieReproduce';
import type { components } from '@/types/api';

/**
 * InquiryApp（問い合わせの共通画面）
 *
 * /customer と /staff の両方から使われる。
 * props の mode で「Customer 用」か「Staff 用」かを切り替える。
 *
 *  - customer: 種別は customer 固定。一覧も customer のみ
 *  - staff:    種別を customer / stuff から選択。一覧は両方（絞り込み可）
 */

// OpenAPI から生成した型。API のレスポンス形と揃えておくとミスが減る
type Sample = components['schemas']['SampleResponse'];

// 画面の役割（どの URL から来たか）
export type InquiryMode = 'customer' | 'staff';
// データ上のトラブル種別（DB / API に保存する値）
type TroubleType = 'customer' | 'stuff';

// バックエンドのベース URL（.env が無ければローカルの 8000 番）
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

/**
 * API の日時（ISO 文字列）を <input type="datetime-local"> 用の形式に変換する。
 * 例: 2026-09-15T12:34:00
 */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type InquiryAppProps = {
  mode: InquiryMode;
};

export default function InquiryApp({ mode }: InquiryAppProps) {
  // mode を毎回比較しなくて済むように、先に真偽値にしておく
  const isCustomer = mode === 'customer';

  // ===== 画面の状態（React の useState） =====
  // 一覧データ
  const [samples, setSamples] = useState<Sample[]>([]);
  // 入力フォームの各項目
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [place, setPlace] = useState('');
  // Customer は最初から customer 固定。Staff は未選択（空文字）から始める
  const [troubleType, setTroubleType] = useState<TroubleType | ''>(
    isCustomer ? 'customer' : '',
  );
  const [troubleDetail, setTroubleDetail] = useState('');
  // メールは一覧には出さない。更新・削除・操作ログ保存の本人確認に使う
  const [email, setEmail] = useState('');
  // null = 新規作成モード / 数字 = その ID を編集中
  const [editingId, setEditingId] = useState<number | null>(null);
  // Terravie 再現オーバーレイを開く対象（null なら閉じている）
  const [reproduceTarget, setReproduceTarget] = useState<{
    id: number;
    name: string;
    email: string;
  } | null>(null);
  // バリデーション用のエラー表示
  const [formError, setFormError] = useState('');
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());

  // ===== 検索用（入力中の値 / 実際に API に送った値を分けている） =====
  // 「検索」ボタンを押すまで一覧を変えないため、applied〜 に確定値を持つ
  const [keyword, setKeyword] = useState('');
  const [searchTroubleType, setSearchTroubleType] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [appliedTroubleType, setAppliedTroubleType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');

  const modeLabel = isCustomer ? 'Customer' : 'Staff';

  /**
   * 一覧を API から取得する。
   * useCallback … 依存値が変わったときだけ関数を作り直す（useEffect の無限ループ防止）。
   */
  const loadSamples = useCallback(
    async (search = appliedKeyword) => {
      const params = new URLSearchParams();

      // Customer: 常に customer のみ
      // Staff: 絞り込みが選ばれていればその種別、空なら全件
      const typeFilter = isCustomer ? 'customer' : appliedTroubleType;
      if (typeFilter) {
        params.set('trouble_type', typeFilter);
      }
      if (search.trim()) {
        params.set('q', search.trim());
      }
      if (appliedDateFrom) {
        params.set('date_from', appliedDateFrom);
      }
      if (appliedDateTo) {
        params.set('date_to', appliedDateTo);
      }

      const query = params.toString();
      // GET /samples?trouble_type=customer&q=... のようにクエリを付ける
      const res = await fetch(`${API_BASE_URL}/samples${query ? `?${query}` : ''}`);
      setSamples(await res.json());
    },
    [isCustomer, appliedKeyword, appliedTroubleType, appliedDateFrom, appliedDateTo],
  );

  // applied〜 や mode が変わったら、自動で一覧を再取得
  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  // 「検索」ボタン: 入力中の条件を applied〜 にコピー → loadSamples が走る
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); // ページ全体のリロードを止める
    setAppliedKeyword(keyword);
    if (!isCustomer) {
      setAppliedTroubleType(searchTroubleType);
    }
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
  };

  // 検索条件を全部リセット
  const handleClearSearch = () => {
    setKeyword('');
    setAppliedKeyword('');
    setSearchTroubleType('');
    setAppliedTroubleType('');
    setDateFrom('');
    setDateTo('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
  };

  // フォームを空にして「新規作成モード」に戻す
  const resetForm = () => {
    setName('');
    setDate('');
    setPlace('');
    setTroubleType(isCustomer ? 'customer' : '');
    setTroubleDetail('');
    setEmail('');
    setEditingId(null);
    setFormError('');
    setMissingFields(new Set());
  };

  // 入力し直した項目だけ、赤字ハイライトを外す
  const clearFieldError = (key: string) => {
    if (formError) setFormError('');
    setMissingFields((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // 空の必須項目を洗い出す（画面表示用の日本語ラベル付き）
  const getMissingRequiredFields = () => {
    const missing: { key: string; label: string }[] = [];
    if (!name.trim()) missing.push({ key: 'name', label: '名前' });
    if (!date) missing.push({ key: 'date', label: '日時' });
    if (!place.trim()) missing.push({ key: 'place', label: '場所' });
    if (!troubleType) missing.push({ key: 'troubleType', label: 'トラブル種別' });
    if (!troubleDetail.trim()) missing.push({ key: 'troubleDetail', label: 'トラブルの詳細' });
    if (!email.trim()) missing.push({ key: 'email', label: 'メールアドレス' });
    return missing;
  };

  // ざっくりしたメール形式チェック（@ の前後に文字があるか）
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  // FastAPI のエラー JSON（{ detail: "..." }）からメッセージを取り出す
  async function readApiError(res: Response, fallback: string): Promise<string> {
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') return body.detail;
    } catch {
      /* JSON でない応答なら fallback を使う */
    }
    return fallback;
  }

  /**
   * 一覧の「編集」押下時:
   * 行の内容をフォームに載せ、メールだけ空にする（本人確認のため再入力させる）。
   */
  const handleStartEdit = (sample: Sample) => {
    setEditingId(sample.id);
    setName(sample.name);
    setDate(toDatetimeLocal(sample.date));
    setPlace(sample.place);
    setTroubleType(
      isCustomer
        ? 'customer'
        : sample.trouble_type === 'stuff'
          ? 'stuff'
          : 'customer',
    );
    setTroubleDetail(sample.trouble_detail);
    setEmail('');
    setFormError('');
    setMissingFields(new Set());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * 追加（POST）または更新（PUT）。
   * editingId が null なら新規、数字ならその ID を更新する。
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- バリデーション ---
    const missing = getMissingRequiredFields();
    if (missing.length > 0) {
      const labels = missing.map((m) => m.label).join('・');
      setMissingFields(new Set(missing.map((m) => m.key)));
      setFormError(
        editingId !== null
          ? `必須項目（${labels}）が未入力のため、更新できません。すべて入力してください。`
          : `必須項目（${labels}）が未入力のため、追加できません。すべて入力してください。`,
      );
      return;
    }
    if (!isValidEmail(email)) {
      setMissingFields(new Set(['email']));
      setFormError('メールアドレスの形式が正しくありません。追加・更新できません。');
      return;
    }

    // Customer 画面では必ず customer にする（改ざん防止の二重チェック）
    const resolvedType: TroubleType = isCustomer ? 'customer' : (troubleType as TroubleType);
    if (isCustomer && resolvedType !== 'customer') {
      setFormError('Customer は trouble type に customer のみ登録できます。');
      return;
    }

    setFormError('');
    setMissingFields(new Set());

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      setMissingFields(new Set(['date']));
      setFormError('日時の形式が正しくありません。もう一度選び直してください。追加できません。');
      return;
    }
    // API には ISO 形式（UTC）で送る
    const formattedDate = parsedDate.toISOString();

    // 更新時は既存の操作ログを消さないよう引き継ぐ
    const existingLog =
      editingId !== null
        ? samples.find((s) => s.id === editingId)?.operation_log ?? null
        : null;

    const body = {
      name,
      date: formattedDate,
      place,
      trouble_type: resolvedType,
      trouble_detail: troubleDetail,
      email: email.trim(),
      operation_log: existingLog,
    };

    // customer 種別の新規追加後は、Terravie 再現画面を開く
    const shouldReproduce = resolvedType === 'customer';
    const ownerEmail = email.trim();

    try {
      if (editingId !== null) {
        // ===== 更新: PUT /samples/{id} =====
        const res = await fetch(`${API_BASE_URL}/samples/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, `更新に失敗しました (${res.status})`));
        }
        resetForm();
        await loadSamples();
      } else {
        // ===== 新規: POST /samples =====
        const res = await fetch(`${API_BASE_URL}/samples`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, `追加に失敗しました (${res.status})`));
        }
        const created: Sample = await res.json();
        resetForm();
        // 一覧更新より先に再現画面を開く（await 失敗で開かない事故を防ぐ）
        if (shouldReproduce && created?.id != null) {
          setReproduceTarget({ id: created.id, name: created.name, email: ownerEmail });
        }
        await loadSamples();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存に失敗しました');
    }
  };

  /**
   * 削除: DELETE /samples/{id}?email=...
   * 登録時と同じメールが必要（バックエンドでも照合している）。
   */
  const handleDelete = async (id: number) => {
    const entered = window.prompt(
      '削除するには、登録時と同じメールアドレスを入力してください。',
    );
    if (entered === null) return; // キャンセル
    const ownerEmail = entered.trim();
    if (!ownerEmail) {
      window.alert('メールアドレスが未入力のため、削除できません。');
      return;
    }

    const res = await fetch(
      `${API_BASE_URL}/samples/${id}?email=${encodeURIComponent(ownerEmail)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      window.alert(await readApiError(res, `削除に失敗しました (${res.status})`));
      return;
    }
    // 編集中の行を消したらフォームもリセット
    if (editingId === id) {
      resetForm();
    }
    loadSamples();
  };

  // 一覧から「再現を記録」→ メール確認後にオーバーレイを開く
  const handleStartReproduce = (sample: Sample) => {
    const entered = window.prompt(
      '操作ログの保存には、登録時と同じメールアドレスが必要です。',
    );
    if (entered === null) return;
    const ownerEmail = entered.trim();
    if (!ownerEmail) {
      window.alert('メールアドレスが未入力のため、再現を開始できません。');
      return;
    }
    setReproduceTarget({ id: sample.id, name: sample.name, email: ownerEmail });
  };

  // 検索がかかっているかどうか（件数表示・クリアボタン用）
  const hasActiveSearch =
    Boolean(appliedKeyword) ||
    Boolean(appliedDateFrom) ||
    Boolean(appliedDateTo) ||
    (!isCustomer && Boolean(appliedTroubleType));

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      {/* ===== Terravie 再現オーバーレイ（customer 種別向け） ===== */}
      {reproduceTarget && (
        <TerravieReproduce
          sampleId={reproduceTarget.id}
          sampleName={reproduceTarget.name}
          email={reproduceTarget.email}
          apiBaseUrl={API_BASE_URL}
          onCompleted={() => {
            setReproduceTarget(null);
            loadSamples(); // 保存した操作ログを一覧に反映
          }}
          onCancel={() => setReproduceTarget(null)}
        />
      )}

      {/* ===== ヘッダー ===== */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{modeLabel}</h1>
        <Link href="/" className="text-sm text-gray-600 hover:underline">
          ← トップへ
        </Link>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        {isCustomer
          ? 'Customer は trouble type「customer」のみ登録・閲覧できます。追加後に Terravie 操作を再現し「トラブル発生を通知」できます。'
          : 'Staff は customer / stuff の両方を登録・閲覧できます。'}
        更新・削除・操作ログ保存には、登録時と同じメールアドレスが必要です（一覧には表示しません）。
      </p>

      {/* ===== 検索フォーム ===== */}
      <form onSubmit={handleSearch} className="mb-6 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2"
            placeholder="キーワードで検索（例: 白浜 パンダ郎）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="キーワード検索"
          />
          {/* 種別絞り込みは Staff だけ（Customer は常に customer のみなので不要） */}
          {!isCustomer && (
            <select
              className="rounded border border-gray-300 bg-white px-3 py-2"
              value={searchTroubleType}
              onChange={(e) => setSearchTroubleType(e.target.value)}
              aria-label="種別で絞り込み"
            >
              <option value="">すべての種別</option>
              <option value="customer">customer</option>
              <option value="stuff">stuff</option>
            </select>
          )}
        </div>
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
        <div className="flex gap-2">
          <button type="submit" className="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-900">
            検索
          </button>
          {hasActiveSearch && (
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

      {/* ===== 作成 / 更新フォーム ===== */}
      <form onSubmit={handleSubmit} noValidate className="mb-6 flex flex-col gap-2">
        {editingId !== null && (
          <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ID {editingId} を編集中 — 登録時と同じメールアドレスを入力してください
          </p>
        )}

        {formError && (
          <div
            role="alert"
            className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
          >
            {formError}
          </div>
        )}
        <p className="text-xs text-gray-500">
          必須: 名前・日時・場所・トラブル種別・トラブルの詳細・メールアドレス
          {isCustomer ? '（種別は customer 固定）' : ''}
        </p>

        <input
          className={`rounded border px-3 py-2 ${
            missingFields.has('name') ? 'border-red-500 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="名前を入力（必須）"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearFieldError('name');
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
            clearFieldError('date');
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
            clearFieldError('place');
          }}
          aria-invalid={missingFields.has('place')}
          aria-required="true"
        />

        {/*
          Customer: 変更できない読み取り専用フィールド
          Staff:    customer / stuff を選べるセレクト
        */}
        {isCustomer ? (
          <input
            className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
            value="customer"
            readOnly
            aria-label="トラブル種別（固定）"
          />
        ) : (
          <select
            className={`rounded border bg-white px-3 py-2 ${
              missingFields.has('troubleType') ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
            value={troubleType}
            onChange={(e) => {
              setTroubleType(e.target.value as TroubleType | '');
              clearFieldError('troubleType');
            }}
            aria-label="トラブル種別（必須）"
            aria-invalid={missingFields.has('troubleType')}
            aria-required="true"
          >
            <option value="">トラブル種別を選択（必須）</option>
            <option value="customer">customer</option>
            <option value="stuff">stuff</option>
          </select>
        )}

        <input
          className={`rounded border px-3 py-2 ${
            missingFields.has('troubleDetail') ? 'border-red-500 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="トラブルの詳細を入力（必須）"
          value={troubleDetail}
          onChange={(e) => {
            setTroubleDetail(e.target.value);
            clearFieldError('troubleDetail');
          }}
          aria-invalid={missingFields.has('troubleDetail')}
          aria-required="true"
        />
        <input
          type="email"
          className={`rounded border px-3 py-2 ${
            missingFields.has('email') ? 'border-red-500 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="メールアドレスを入力（必須・一覧非表示）"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFieldError('email');
          }}
          aria-label="メールアドレス（必須）"
          aria-invalid={missingFields.has('email')}
          aria-required="true"
          autoComplete="email"
        />
        <div className="flex gap-2">
          <button type="submit" className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
            {editingId !== null ? '更新' : '追加'}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              キャンセル
            </button>
          )}
        </div>
      </form>

      {/* ===== 一覧 ===== */}
      {hasActiveSearch && (
        <p className="mb-3 text-sm text-gray-600">
          検索結果: {samples.length}件
          {appliedDateFrom || appliedDateTo
            ? `（期間: ${appliedDateFrom || '…'} 〜 ${appliedDateTo || '…'}）`
            : ''}
        </p>
      )}

      {samples.length === 0 ? (
        <p className="text-sm text-gray-500">
          {hasActiveSearch ? '一致するデータがありません。' : 'まだデータがありません。'}
        </p>
      ) : (
        <ul className="space-y-3">
          {/* key={sample.id} … React が行の追加・削除を正しく追跡するために必要 */}
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
                    {/* 種別バッジ（色で customer / stuff を区別） */}
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
                <div className="flex flex-col items-end gap-2">
                  {/* 再現ボタンは customer 種別の行だけ表示 */}
                  {sample.trouble_type === 'customer' && (
                    <button
                      type="button"
                      onClick={() => handleStartReproduce(sample)}
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
              </div>

              {sample.trouble_detail && (
                <div className="rounded bg-gray-50 p-2 text-xs text-gray-700 whitespace-pre-wrap">
                  <span className="mb-0.5 block font-semibold text-gray-500">【トラブル内容】</span>
                  {sample.trouble_detail}
                </div>
              )}

              {sample.operation_log && (
                <div className="rounded border border-emerald-100 bg-emerald-50/60 p-2 text-xs text-gray-800 whitespace-pre-wrap">
                  <span className="mb-0.5 block font-semibold text-emerald-800">
                    【操作ログ（トラブル発生通知まで）】
                  </span>
                  {sample.operation_log}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
