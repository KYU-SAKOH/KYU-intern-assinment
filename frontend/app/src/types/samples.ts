/**
 * スタッフ画面で使う問い合わせまわりの型
 *
 * OpenAPI 生成型（types/api.ts）とずれることがある追加フィールドも含む。
 * page.tsx と各パネル／ウィザードで共有する。
 */

import type { SampleStatus } from '@/lib/sampleStatus';

export type TroubleType = 'customer' | 'stuff';

export type PageView =
  | 'home'
  | 'triageResult'
  | 'unresolvedChoice'
  | 'detailForm'
  | 'editRegistered';

export type SimilarSample = {
  id: number;
  name: string;
  date: string;
  place: string;
  trouble_type: string;
  trouble_detail: string;
  expected_actions?: string | null;
  actual_actions?: string | null;
  error_code?: string | null;
  ai_initial_response?: string | null;
  status?: SampleStatus;
};

export type TriageResult = {
  status: 'ok' | 'needs_reentry';
  reentry_reasons: string[];
  similar_samples: SimilarSample[];
  initial_response: string | null;
};

export type DraftSample = {
  id: number;
  name: string;
  date: string;
  expected_actions?: string | null;
  actual_actions?: string | null;
  error_code?: string | null;
  is_draft?: boolean;
};

export type RegisteredSample = {
  id: number;
  name: string;
  date: string;
  place: string;
  trouble_type: string;
  trouble_detail: string;
  expected_actions?: string | null;
  actual_actions?: string | null;
  error_code?: string | null;
  ai_initial_response?: string | null;
  status?: SampleStatus;
  reproduction_steps?: string[];
  reproduction_rate?: string | null;
  severity?: string | null;
  screenshot_path?: string | null;
  device_info?: string | null;
  staff_notify_unread?: boolean;
  staff_notify_kind?: string | null;
  staff_notify_at?: string | null;
  staff_notify_summary?: string | null;
};

export type DetailContext = {
  expected: string;
  actual: string;
  error: string;
  aiResponse: string | null;
};
