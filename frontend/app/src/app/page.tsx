import Link from 'next/link';

/**
 * トップページ（ / ）
 *
 * 最初に「Customer」か「Staff」を選ばせる画面。
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
    </main>
  );
}
