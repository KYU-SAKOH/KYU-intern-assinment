import Link from 'next/link';

/**
 * トップページ（ / ）
 *
 * 最初に「Customer」か「Staff」を選ばせる画面。
 * 管理者画面は通常ボタンではなく、下の案内どおり URL で開く（誤操作を減らすため）。
 * Next.js の Link で別ページ（/customer, /staff）へ移動する。
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold">Sample App</h1>
      <p className="mb-8 text-sm text-gray-600">利用する画面を選んでください。</p>

      <div className="flex flex-col gap-3">
        {/* href="/customer" → app/customer/page.tsx が表示される */}
        <Link
          href="/customer"
          className="rounded border border-blue-200 bg-blue-50 px-4 py-4 text-center font-semibold text-blue-900 hover:bg-blue-100"
        >
          Customer
          <span className="mt-1 block text-xs font-normal text-blue-700">
            customer のみ登録・閲覧
          </span>
        </Link>

        {/* href="/staff" → app/staff/page.tsx が表示される */}
        <Link
          href="/staff"
          className="rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-center font-semibold text-emerald-900 hover:bg-emerald-100"
        >
          Staff
          <span className="mt-1 block text-xs font-normal text-emerald-700">
            customer / stuff の両方を登録・閲覧
          </span>
        </Link>
      </div>

      {/*
        管理者画面への入り方:
        大きなボタンにすると誤タップしやすいので、説明文 + 控えめなリンクにしている。
        実 URL は http://localhost:3000/admin （app/admin/page.tsx）
      */}
      <section className="mt-10 rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">管理者画面の開き方</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            ブラウザのアドレス欄に{' '}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">http://localhost:3000/admin</code>{' '}
            と入力してアクセスする
          </li>
          <li>または、下のリンク「Administrator」をクリックする</li>
        </ol>
        <p className="mt-2 text-xs text-gray-500">
          管理者画面では、対応状況（未対応 / 一時対応済み / 完全対応済み）の変更とコメント追加、
          キーワード・種別・期間での検索ができます。
        </p>
        <Link
          href="/admin"
          className="mt-3 inline-block text-sm font-medium text-gray-800 underline hover:text-gray-600"
        >
          Administrator を開く
        </Link>
      </section>
    </main>
  );
}
