'use client';

/**
 * ホーム／トリアージ結果の装飾マスコット（操作対象外）
 * ヘッダ余白のみ絶対配置。セクション間は InlineMascot を使う。
 * サイズは旧パンダ (w-24 / sm:w-32) の 1.2 倍で全マスコット共通。
 */

/** 96px×1.2 / 128px×1.2 */
export const MASCOT_SIZE_CLASS = 'w-[7.2rem] sm:w-[9.6rem]';

type PageMascotsProps = {
  variant: 'home' | 'triage';
};

function Mascot({
  src,
  className,
}: {
  src: string;
  className: string;
}) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={`pointer-events-none select-none opacity-85 ${MASCOT_SIZE_CLASS} ${className}`}
    />
  );
}

/** セクション見出し横などに置くインライン装飾 */
export function InlineMascot({
  src,
  className = '',
}: {
  src: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={`pointer-events-none select-none opacity-85 ${MASCOT_SIZE_CLASS} ${className}`}
    />
  );
}

export default function PageMascots({ variant }: PageMascotsProps) {
  if (variant === 'home') {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-44 overflow-visible"
        aria-hidden
      >
        <Mascot
          src="/mascots/panda.png"
          className="absolute right-0 top-0 sm:right-1"
        />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-44 overflow-visible"
      aria-hidden
    >
      <Mascot
        src="/mascots/penguin-brown.png"
        className="absolute right-0 top-2 sm:right-1"
      />
    </div>
  );
}
