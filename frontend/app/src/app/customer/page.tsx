'use client';

import InquiryApp from '@/components/InquiryApp';

/**
 * Customer 画面（ /customer ）
 *
 * 共通コンポーネント InquiryApp に mode="customer" を渡すだけ。
 * → トラブル種別は customer 固定、一覧も customer のみ表示される。
 *
 * 'use client' … このファイル内で useState などのブラウザ向け機能を使う宣言。
 * （InquiryApp 側で使うため、このページも Client Component にする）
 */
export default function CustomerPage() {
  return <InquiryApp mode="customer" />;
}
