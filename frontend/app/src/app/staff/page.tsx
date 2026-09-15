'use client';

import InquiryApp from '@/components/InquiryApp';

/**
 * Staff 画面（ /staff ）
 *
 * 共通コンポーネント InquiryApp に mode="staff" を渡すだけ。
 * → トラブル種別を customer / stuff から選べ、一覧も両方見られる。
 *
 * Customer / Staff で UI の大部分は同じなので、
 * 差分は mode の値だけで切り替える設計にしている。
 */
export default function StaffPage() {
  return <InquiryApp mode="staff" />;
}
