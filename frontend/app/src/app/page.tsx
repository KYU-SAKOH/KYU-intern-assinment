'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import DetailWizard, { type DetailStep } from '@/components/DetailWizard';
import SampleChat from '@/components/SampleChat';
import DraftListSection from '@/components/triage/DraftListSection';
import RegisteredListSection from '@/components/triage/RegisteredListSection';
import TriageInputPanel from '@/components/triage/TriageInputPanel';
import TriageResultPanel from '@/components/triage/TriageResultPanel';
import UnresolvedChoicePanel from '@/components/triage/UnresolvedChoicePanel';
import { API_BASE_URL, readApiError } from '@/lib/api';
import {
  isValidEmail,
  REPRODUCTION_RATE_LABELS,
  SEVERITY_LABELS,
  stepsLookApproved,
} from '@/lib/reproductionStepsUi';
import {
  canEditRegisteredStatus,
  statusBadgeClass,
  statusLabelJa,
} from '@/lib/sampleStatus';
import type {
  DetailContext,
  DraftSample,
  PageView,
  RegisteredSample,
  SimilarSample,
  TriageResult,
  TroubleType,
} from '@/types/samples';

/**
 * スタッフ向けトップページ（ / ）
 *
 * 画面の流れ（view）:
 *   home →（AIトリアージ）→ triageResult → unresolvedChoice
 *        → detailForm（新規／下書き確定）または editRegistered（登録済み）
 *
 * このファイルの役割:
 *   - 状態（useState）と API 呼び出しをまとめる
 *   - どのパネル／ウィザードを出すか切り替える
 *   UI の詳細は components/ 配下に分割している
 *
 * 主な API: POST /triage, /reproduction-assist, /samples/draft|complete, PATCH finalize, PUT/DELETE samples
 */

export default function Home() {
  const [view, setView] = useState<PageView>('home');

  const [expectedActions, setExpectedActions] = useState('');
  const [actualActions, setActualActions] = useState('');
  const [errorCode, setErrorCode] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [triageError, setTriageError] = useState('');
  const [triage, setTriage] = useState<TriageResult | null>(null);

  const [drafts, setDrafts] = useState<DraftSample[]>([]);
  const [draftKeyword, setDraftKeyword] = useState('');
  const [appliedDraftKeyword, setAppliedDraftKeyword] = useState('');

  const [registered, setRegistered] = useState<RegisteredSample[]>([]);
  const [registeredKeyword, setRegisteredKeyword] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredStatus, setRegisteredStatus] = useState('');
  const [registeredDateFrom, setRegisteredDateFrom] = useState('');
  const [registeredDateTo, setRegisteredDateTo] = useState('');
  const [appliedRegisteredKeyword, setAppliedRegisteredKeyword] = useState('');
  const [appliedRegisteredEmail, setAppliedRegisteredEmail] = useState('');
  const [appliedRegisteredStatus, setAppliedRegisteredStatus] = useState('');
  const [appliedRegisteredDateFrom, setAppliedRegisteredDateFrom] = useState('');
  const [appliedRegisteredDateTo, setAppliedRegisteredDateTo] = useState('');

  const [selectedRegistered, setSelectedRegistered] =
    useState<RegisteredSample | null>(null);
  const [detailReturnView, setDetailReturnView] = useState<'home' | 'triageResult'>(
    'home',
  );
  const [editExpected, setEditExpected] = useState('');
  const [editActual, setEditActual] = useState('');
  const [editErrorCode, setEditErrorCode] = useState('');

  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [troubleType, setTroubleType] = useState<TroubleType | ''>('');
  const [email, setEmail] = useState('');

  const [detailMode, setDetailMode] = useState<'newComplete' | 'finalizeDraft'>(
    'newComplete',
  );
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [detailContext, setDetailContext] = useState<DetailContext | null>(null);
  const [detailStep, setDetailStep] = useState<DetailStep>(1);
  const [reproductionSteps, setReproductionSteps] = useState<string[]>([
    '',
    '',
    '',
  ]);
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistError, setAssistError] = useState('');
  const [gapWarnings, setGapWarnings] = useState<string[]>([]);
  const [suggestedNextSteps, setSuggestedNextSteps] = useState<string[]>([]);
  const [stepsAiApproved, setStepsAiApproved] = useState(false);
  const [reproductionRate, setReproductionRate] = useState('');
  const [severity, setSeverity] = useState('');
  const [screenshotPath, setScreenshotPath] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  /** 詳細画面でこのセッション中にスタッフがチャット返信したか */
  const [staffRepliedThisSession, setStaffRepliedThisSession] = useState(false);
  /** 一覧に戻ったあと未読が残ったときの案内 */
  const [homeNotice, setHomeNotice] = useState('');

  const loadDrafts = useCallback(
    async (q = appliedDraftKeyword) => {
      const params = new URLSearchParams({ is_draft: 'true' });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`${API_BASE_URL}/samples?${params.toString()}`);
      if (res.ok) {
        setDrafts(await res.json());
      }
    },
    [appliedDraftKeyword],
  );

  const loadRegistered = useCallback(async () => {
    const params = new URLSearchParams({ is_draft: 'false' });
    if (appliedRegisteredKeyword.trim()) {
      params.set('q', appliedRegisteredKeyword.trim());
    }
    if (appliedRegisteredEmail.trim()) {
      params.set('email', appliedRegisteredEmail.trim());
    }
    if (appliedRegisteredStatus) {
      params.set('status', appliedRegisteredStatus);
    }
    if (appliedRegisteredDateFrom) {
      params.set('date_from', appliedRegisteredDateFrom);
    }
    if (appliedRegisteredDateTo) {
      params.set('date_to', appliedRegisteredDateTo);
    }
    const res = await fetch(`${API_BASE_URL}/samples?${params.toString()}`);
    if (res.ok) {
      setRegistered(await res.json());
    }
  }, [
    appliedRegisteredKeyword,
    appliedRegisteredEmail,
    appliedRegisteredStatus,
    appliedRegisteredDateFrom,
    appliedRegisteredDateTo,
  ]);

  useEffect(() => {
    loadDrafts();
    loadRegistered();
  }, [loadDrafts, loadRegistered]);

  // ホーム表示中は管理者更新を拾えるよう定期的に登録一覧を再取得する
  useEffect(() => {
    if (view !== 'home') return;
    const timer = window.setInterval(() => {
      void loadRegistered();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [view, loadRegistered]);

  const resetDetailWizardFields = () => {
    setDetailStep(1);
    setReproductionSteps(['', '', '']);
    setAssistLoading(false);
    setAssistError('');
    setGapWarnings([]);
    setSuggestedNextSteps([]);
    setStepsAiApproved(false);
    setReproductionRate('');
    setSeverity('');
    setScreenshotPath('');
    setDeviceInfo('');
    setUploadingScreenshot(false);
  };

  const resetTriageSession = () => {
    setExpectedActions('');
    setActualActions('');
    setErrorCode('');
    setTriage(null);
    setTriageError('');
    setName('');
    setPlace('');
    setTroubleType('');
    setEmail('');
    setDetailContext(null);
    setSelectedDraftId(null);
    setDetailMode('newComplete');
    resetDetailWizardFields();
    setActionError('');
    setActionSuccess('');
    setView('home');
  };

  const invalidateStepsApproval = () => {
    setStepsAiApproved(false);
    setGapWarnings([]);
    setSuggestedNextSteps([]);
    setAssistError('');
  };

  const updateReproductionStep = (index: number, value: string) => {
    setReproductionSteps((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    invalidateStepsApproval();
  };

  const addReproductionStep = () => {
    setReproductionSteps((prev) => {
      if (prev.length >= 15) return prev;
      return [...prev, ''];
    });
    invalidateStepsApproval();
  };

  const removeReproductionStep = (index: number) => {
    setReproductionSteps((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    invalidateStepsApproval();
  };

  const moveReproductionStep = (index: number, direction: -1 | 1) => {
    setReproductionSteps((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    invalidateStepsApproval();
  };

  const appendSuggestedStep = (text: string) => {
    setReproductionSteps((prev) => (prev.length >= 15 ? prev : [...prev, text]));
    invalidateStepsApproval();
  };

  const cleanedReproductionSteps = () =>
    reproductionSteps.map((s) => s.trim()).filter(Boolean);

  const goDetailNext = async () => {
    setActionError('');
    if (detailStep === 1) {
      if (view === 'editRegistered') {
        if (
          !name.trim() ||
          !place.trim() ||
          !troubleType ||
          !email.trim() ||
          !editExpected.trim() ||
          !editActual.trim()
        ) {
          setActionError(
            '報告者名・場所・種別・メール・期待結果・実際の結果は必須です。',
          );
          return;
        }
      } else if (!place.trim() || !troubleType || !email.trim()) {
        setActionError('場所・種別・メールは必須です。');
        return;
      }
      if (!isValidEmail(email)) {
        setActionError('メールアドレスの形式が正しくありません。');
        return;
      }
      setDetailStep(2);
      return;
    }
    if (detailStep === 2) {
      if (!stepsAiApproved) {
        setActionError(
          'AIチェックで合格するまで次へ進めません。「AIにチェックしてもらう」を実行してください。',
        );
        return;
      }
      setDetailStep(3);
    }
  };

  const goDetailBack = () => {
    setActionError('');
    if (detailStep === 2) setDetailStep(1);
    else if (detailStep === 3) setDetailStep(2);
  };

  const handleWizardStepTab = (step: DetailStep) => {
    if (step < detailStep) {
      setDetailStep(step);
      setActionError('');
      return;
    }
    if (step === detailStep) return;
    if (step === 2 && detailStep === 1) {
      void goDetailNext();
      return;
    }
    if (step === 3 && stepsAiApproved && (detailStep === 1 || detailStep === 2)) {
      if (view === 'editRegistered') {
        if (
          detailStep === 1 &&
          (!name.trim() ||
            !place.trim() ||
            !troubleType ||
            !email.trim() ||
            !editExpected.trim() ||
            !editActual.trim() ||
            !isValidEmail(email))
        ) {
          setActionError('①の必須項目を先に入力してください。');
          return;
        }
      } else if (
        detailStep === 1 &&
        (!place.trim() || !troubleType || !email.trim() || !isValidEmail(email))
      ) {
        setActionError('①の場所・種別・メールを先に入力してください。');
        return;
      }
      setDetailStep(3);
      setActionError('');
    }
  };

  const runReproductionAssist = async () => {
    setAssistError('');
    setActionError('');
    const steps = cleanedReproductionSteps();
    if (steps.length < 3) {
      setAssistError('再現手順は少なくとも3件入力してください。');
      setStepsAiApproved(false);
      return;
    }
    const expected =
      view === 'editRegistered' ? editExpected.trim() : (detailContext?.expected ?? '');
    const actual =
      view === 'editRegistered' ? editActual.trim() : (detailContext?.actual ?? '');
    const errCode =
      view === 'editRegistered'
        ? editErrorCode.trim() || null
        : detailContext?.error || null;
    setAssistLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reproduction-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reproduction_steps: steps,
          expected_actions: expected,
          actual_actions: actual,
          error_code: errCode,
        }),
      });
      if (!res.ok) {
        throw new Error(
          await readApiError(res, `AIチェックに失敗しました (${res.status})`),
        );
      }
      const data = (await res.json()) as {
        gap_warnings: string[];
        suggested_next_steps: string[];
        can_proceed: boolean;
      };
      setGapWarnings(data.gap_warnings ?? []);
      setSuggestedNextSteps(data.suggested_next_steps ?? []);
      setStepsAiApproved(Boolean(data.can_proceed));
      if (!data.can_proceed) {
        setAssistError(
          '指摘を確認し、手順を追加・修正してから再度チェックしてください。',
        );
      }
    } catch (err) {
      setStepsAiApproved(false);
      setAssistError(
        err instanceof Error ? err.message : 'AIチェックに失敗しました。',
      );
    } finally {
      setAssistLoading(false);
    }
  };

  const handleScreenshotUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingScreenshot(true);
    setActionError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE_URL}/uploads/screenshot`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        throw new Error(
          await readApiError(res, `アップロードに失敗しました (${res.status})`),
        );
      }
      const data = (await res.json()) as { path: string };
      setScreenshotPath(data.path);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'アップロードに失敗しました。',
      );
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const runTriage = async () => {
    setTriageError('');
    setActionError('');
    setActionSuccess('');

    if (!expectedActions.trim() || !actualActions.trim()) {
      setTriageError(
        '「実施した操作と期待結果」「実施した操作と実際の結果」は必須です。',
      );
      return;
    }

    setAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_actions: expectedActions.trim(),
          actual_actions: actualActions.trim(),
          error_code: errorCode.trim() || null,
        }),
      });
      if (!res.ok) {
        throw new Error(
          await readApiError(res, `分析に失敗しました (${res.status})`),
        );
      }
      const data = (await res.json()) as TriageResult;
      setTriage(data);
      setView(data.status === 'needs_reentry' ? 'home' : 'triageResult');
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : '分析に失敗しました。');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setTriage(null);
    await runTriage();
  };

  const goHome = () => {
    setSelectedRegistered(null);
    setEditExpected('');
    setEditActual('');
    setEditErrorCode('');
    setDetailReturnView('home');
    resetDetailWizardFields();
    setActionError('');
    setActionSuccess('');
    setView('home');
    loadDrafts();
    loadRegistered();
  };

  const leaveRegisteredDetail = async () => {
    const sample = selectedRegistered;
    // 前回の案内を消してから、今回の結果だけで出し直す
    setHomeNotice('');

    if (sample?.staff_notify_unread) {
      const mail = email.trim();
      const fullyResolved = sample.status === 'Fully Resolved';
      const needsReply =
        !fullyResolved && sample.staff_notify_kind === 'comment';
      const canClear =
        Boolean(mail) && (!needsReply || staffRepliedThisSession);

      if (canClear) {
        const cleared = await markStaffNotificationRead(sample.id, mail);
        if (!cleared) {
          setHomeNotice(
            'メールが一致せず未読を消せませんでした。登録時のメールを確認してください。',
          );
        }
      } else if (!mail) {
        setHomeNotice(
          '未読は残っています。詳細で登録メールを入力してから一覧に戻ると消えます。',
        );
      } else if (needsReply && !staffRepliedThisSession) {
        setHomeNotice(
          '未読は残っています。管理者コメントにはチャットで返信してから一覧に戻ると消えます。',
        );
      }
    }

    setStaffRepliedThisSession(false);

    if (detailReturnView === 'triageResult') {
      setSelectedRegistered(null);
      setEditExpected('');
      setEditActual('');
      setEditErrorCode('');
      resetDetailWizardFields();
      setActionError('');
      setActionSuccess('');
      setDetailReturnView('home');
      setView('triageResult');
      return;
    }
    goHome();
  };

  const handleResolved = () => {
    resetTriageSession();
    loadDrafts();
    loadRegistered();
  };

  const handleUnresolved = () => {
    setActionError('');
    setView('unresolvedChoice');
  };

  const openDetailFormNew = () => {
    if (!name.trim()) {
      setActionError('報告者名を入力してください。');
      return;
    }
    setDetailMode('newComplete');
    setSelectedDraftId(null);
    setDetailContext({
      expected: expectedActions.trim(),
      actual: actualActions.trim(),
      error: errorCode.trim(),
      aiResponse: triage?.initial_response ?? null,
    });
    setPlace('');
    setTroubleType('');
    setEmail('');
    resetDetailWizardFields();
    setActionError('');
    setView('detailForm');
  };

  const openDetailFormForDraft = (draft: DraftSample) => {
    setDetailMode('finalizeDraft');
    setSelectedDraftId(draft.id);
    setDetailContext({
      expected: draft.expected_actions ?? '',
      actual: draft.actual_actions ?? '',
      error: draft.error_code ?? '',
      aiResponse: null,
    });
    setName(draft.name);
    setPlace('');
    setTroubleType('');
    setEmail('');
    resetDetailWizardFields();
    setActionError('');
    setView('detailForm');
  };

  const handleTemporarySave = async () => {
    if (!triage || triage.status !== 'ok') return;
    if (!name.trim()) {
      setActionError('報告者名を入力してください。');
      return;
    }
    setSubmitting(true);
    setActionError('');
    try {
      const res = await fetch(`${API_BASE_URL}/samples/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          expected_actions: expectedActions.trim(),
          actual_actions: actualActions.trim(),
          error_code: errorCode.trim() || null,
          ai_initial_response: triage.initial_response,
        }),
      });
      if (!res.ok) {
        throw new Error(
          await readApiError(res, `一時保存に失敗しました (${res.status})`),
        );
      }
      resetTriageSession();
      await loadDrafts();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : '一時保存に失敗しました。',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!name.trim() || !place.trim() || !troubleType || !email.trim()) {
      setActionError('報告者名・場所・種別・メールは必須です。');
      return;
    }
    if (!isValidEmail(email)) {
      setActionError('メールアドレスの形式が正しくありません。');
      return;
    }
    if (!detailContext) {
      setActionError('入力内容がありません。');
      return;
    }
    if (!stepsAiApproved) {
      setActionError(
        '再現手順の AI チェックが完了していません。②に戻って確認してください。',
      );
      setDetailStep(2);
      return;
    }
    const steps = cleanedReproductionSteps();
    if (steps.length < 3) {
      setActionError('再現手順は少なくとも3件必要です。');
      setDetailStep(2);
      return;
    }

    const detailPayload = {
      reproduction_steps: steps,
      reproduction_rate: reproductionRate || null,
      severity: severity || null,
      screenshot_path: screenshotPath || null,
      device_info: deviceInfo.trim() || null,
    };

    setSubmitting(true);
    try {
      if (detailMode === 'finalizeDraft' && selectedDraftId !== null) {
        const res = await fetch(
          `${API_BASE_URL}/samples/${selectedDraftId}/finalize`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name.trim(),
              place: place.trim(),
              trouble_type: troubleType,
              email: email.trim(),
              ...detailPayload,
            }),
          },
        );
        if (!res.ok) {
          throw new Error(
            await readApiError(res, `登録に失敗しました (${res.status})`),
          );
        }
        setActionSuccess('詳細を登録しました。');
      } else {
        const res = await fetch(`${API_BASE_URL}/samples/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            place: place.trim(),
            trouble_type: troubleType,
            email: email.trim(),
            expected_actions: detailContext.expected,
            actual_actions: detailContext.actual,
            error_code: detailContext.error || null,
            ai_initial_response: detailContext.aiResponse,
            ...detailPayload,
          }),
        });
        if (!res.ok) {
          throw new Error(
            await readApiError(res, `登録に失敗しました (${res.status})`),
          );
        }
        setActionSuccess('問い合わせを登録しました。');
      }
      resetTriageSession();
      await loadDrafts();
      await loadRegistered();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '登録に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const markStaffNotificationRead = async (
    sampleId: number,
    ownerEmail: string,
  ): Promise<boolean> => {
    const mail = ownerEmail.trim();
    if (!mail) return false;
    try {
      const res = await fetch(
        `${API_BASE_URL}/samples/${sampleId}/notifications/read?email=${encodeURIComponent(mail)}`,
        { method: 'PATCH' },
      );
      if (!res.ok) return false;
      setRegistered((prev) =>
        prev.map((s) =>
          s.id === sampleId
            ? {
                ...s,
                staff_notify_unread: false,
                staff_notify_kind: null,
                staff_notify_at: null,
                staff_notify_summary: null,
              }
            : s,
        ),
      );
      setSelectedRegistered((prev) =>
        prev && prev.id === sampleId
          ? {
              ...prev,
              staff_notify_unread: false,
              staff_notify_kind: null,
              staff_notify_at: null,
              staff_notify_summary: null,
            }
          : prev,
      );
      return true;
    } catch {
      return false;
    }
  };

  const openRegisteredSample = (
    sample: RegisteredSample,
    returnView: 'home' | 'triageResult' = 'home',
  ) => {
    setSelectedRegistered(sample);
    setDetailReturnView(returnView);
    setEditExpected(sample.expected_actions ?? '');
    setEditActual(sample.actual_actions ?? '');
    setEditErrorCode(sample.error_code ?? '');
    setName(sample.name);
    setPlace(sample.place);
    setTroubleType(sample.trouble_type === 'stuff' ? 'stuff' : 'customer');
    setEmail('');
    setStaffRepliedThisSession(false);
    setHomeNotice('');
    const existingSteps =
      sample.reproduction_steps && sample.reproduction_steps.length > 0
        ? [...sample.reproduction_steps]
        : ['', '', ''];
    setDetailStep(1);
    setReproductionSteps(existingSteps);
    setAssistLoading(false);
    setAssistError('');
    setGapWarnings([]);
    setSuggestedNextSteps([]);
    setStepsAiApproved(stepsLookApproved(existingSteps));
    setReproductionRate(sample.reproduction_rate ?? '');
    setSeverity(sample.severity ?? '');
    setScreenshotPath(sample.screenshot_path ?? '');
    setDeviceInfo(sample.device_info ?? '');
    setUploadingScreenshot(false);
    setActionError('');
    setActionSuccess('');
    setView('editRegistered');
  };

  const openSimilarSample = async (similar: SimilarSample) => {
    setActionError('');
    try {
      let full: RegisteredSample | undefined = registered.find(
        (r) => r.id === similar.id,
      );
      if (!full) {
        const res = await fetch(`${API_BASE_URL}/samples`);
        if (!res.ok) {
          throw new Error(`詳細の取得に失敗しました (${res.status})`);
        }
        const all: RegisteredSample[] = await res.json();
        full = all.find((r) => r.id === similar.id);
      }
      if (!full) {
        throw new Error('類似サンプルの詳細が見つかりませんでした。');
      }
      openRegisteredSample(full, 'triageResult');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : '詳細を開けませんでした。',
      );
    }
  };

  const handleRegisteredSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    if (!selectedRegistered || !canEditRegisteredStatus(selectedRegistered.status)) {
      return;
    }
    if (
      !name.trim() ||
      !place.trim() ||
      !troubleType ||
      !email.trim() ||
      !editExpected.trim() ||
      !editActual.trim()
    ) {
      setActionError(
        '報告者名・場所・種別・メール・期待結果・実際の結果は必須です。',
      );
      return;
    }
    if (!isValidEmail(email)) {
      setActionError('メールアドレスの形式が正しくありません。');
      return;
    }
    if (!stepsAiApproved) {
      setActionError(
        '再現手順の AI チェックが完了していません。②に戻って確認してください。',
      );
      setDetailStep(2);
      return;
    }
    const steps = cleanedReproductionSteps();
    if (steps.length < 3) {
      setActionError('再現手順は少なくとも3件必要です。');
      setDetailStep(2);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/samples/${selectedRegistered.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            date: selectedRegistered.date,
            place: place.trim(),
            trouble_type: troubleType,
            trouble_detail: selectedRegistered.trouble_detail ?? '',
            email: email.trim(),
            expected_actions: editExpected.trim(),
            actual_actions: editActual.trim(),
            error_code: editErrorCode.trim() || null,
            ai_initial_response: selectedRegistered.ai_initial_response ?? null,
            reproduction_steps: steps,
            reproduction_rate: reproductionRate || null,
            severity: severity || null,
            screenshot_path: screenshotPath || null,
            device_info: deviceInfo.trim() || null,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(
          await readApiError(res, `更新に失敗しました (${res.status})`),
        );
      }
      setActionSuccess('更新しました。');
      goHome();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '更新に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisteredDelete = async () => {
    if (!selectedRegistered || !canEditRegisteredStatus(selectedRegistered.status)) {
      return;
    }
    if (!email.trim()) {
      setActionError('削除には登録時のメールアドレスが必要です。');
      return;
    }
    if (!isValidEmail(email)) {
      setActionError('メールアドレスの形式が正しくありません。');
      return;
    }
    if (
      !window.confirm(
        `サンプル #${selectedRegistered.id} を削除します。よろしいですか？`,
      )
    ) {
      return;
    }

    setSubmitting(true);
    setActionError('');
    try {
      const res = await fetch(
        `${API_BASE_URL}/samples/${selectedRegistered.id}?email=${encodeURIComponent(email.trim())}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        throw new Error(
          await readApiError(res, `削除に失敗しました (${res.status})`),
        );
      }
      goHome();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '削除に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const wizardSharedProps = {
    detailStep,
    onSelectStep: handleWizardStepTab,
    reproductionSteps,
    onUpdateStep: updateReproductionStep,
    onAddStep: addReproductionStep,
    onRemoveStep: removeReproductionStep,
    onMoveStep: moveReproductionStep,
    onAppendSuggestedStep: appendSuggestedStep,
    assistLoading,
    assistError,
    gapWarnings,
    suggestedNextSteps,
    stepsAiApproved,
    onRunAssist: () => void runReproductionAssist(),
    reproductionRate,
    onReproductionRateChange: setReproductionRate,
    severity,
    onSeverityChange: setSeverity,
    screenshotPath,
    uploadingScreenshot,
    onScreenshotFile: (file: File | null) => void handleScreenshotUpload(file),
    deviceInfo,
    onDeviceInfoChange: setDeviceInfo,
    actionError,
    actionSuccess,
    submitting,
    onBack: goDetailBack,
  };

  const notifyUnread = Boolean(selectedRegistered?.staff_notify_unread);
  const notifyNeedsReply =
    notifyUnread &&
    selectedRegistered?.status !== 'Fully Resolved' &&
    selectedRegistered?.staff_notify_kind === 'comment';
  const notifyEmailDone = Boolean(email.trim());
  const notifyReplyDone = !notifyNeedsReply || staffRepliedThisSession;
  const notifyCanClear = notifyUnread && notifyEmailDone && notifyReplyDone;
  const leaveButtonLabel = notifyCanClear
    ? '一覧に戻る（未読を消す）'
    : '一覧に戻る';
  const leaveButtonClass = notifyCanClear
    ? 'inline-flex min-h-12 items-center rounded-lg bg-amber-600 px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-amber-700'
    : 'inline-flex min-h-12 items-center rounded-lg bg-sky-600 px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-sky-700';

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">terravie トラブル報告フォーム</h1>
        <p className="mt-2 text-sm text-gray-600">
          新しいトラブルを入力すると、AI が類似事例と一次回答を提示します。
        </p>
        <nav className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/admin" className="text-gray-700 underline hover:text-gray-900">
            Administrator
          </Link>
        </nav>
      </header>

      {view === 'home' && (
        <>
          {homeNotice && (
            <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p>{homeNotice}</p>
              <button
                type="button"
                onClick={() => setHomeNotice('')}
                className="mt-2 text-xs font-semibold underline"
              >
                閉じる
              </button>
            </div>
          )}
          {registered.some((s) => s.staff_notify_unread) && (
            <div className="mb-6 rounded-lg border-2 border-amber-500 bg-amber-100 px-4 py-3 shadow-sm">
              <p className="text-base font-bold text-amber-950">
                管理者からの更新が{' '}
                {registered.filter((s) => s.staff_notify_unread).length}{' '}
                件あります
              </p>
              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById('registered-samples')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="mt-2 rounded border-2 border-amber-700 bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
              >
                登録済み一覧を見る
              </button>
            </div>
          )}
          <TriageInputPanel
            name={name}
            onNameChange={setName}
            expectedActions={expectedActions}
            onExpectedChange={setExpectedActions}
            actualActions={actualActions}
            onActualChange={setActualActions}
            errorCode={errorCode}
            onErrorCodeChange={setErrorCode}
            triageError={triageError}
            analyzing={analyzing}
            triage={triage}
            onSubmit={(e) => void handleAnalyze(e)}
          />
          <DraftListSection
            drafts={drafts}
            draftKeyword={draftKeyword}
            onDraftKeywordChange={setDraftKeyword}
            onSearch={(e) => {
              e.preventDefault();
              setAppliedDraftKeyword(draftKeyword);
            }}
            onOpenDraft={openDetailFormForDraft}
          />
          <RegisteredListSection
            registered={registered}
            registeredKeyword={registeredKeyword}
            onKeywordChange={setRegisteredKeyword}
            registeredEmail={registeredEmail}
            onEmailChange={setRegisteredEmail}
            registeredStatus={registeredStatus}
            onStatusChange={setRegisteredStatus}
            registeredDateFrom={registeredDateFrom}
            onDateFromChange={setRegisteredDateFrom}
            registeredDateTo={registeredDateTo}
            onDateToChange={setRegisteredDateTo}
            onSearch={(e) => {
              e.preventDefault();
              setAppliedRegisteredKeyword(registeredKeyword);
              setAppliedRegisteredEmail(registeredEmail);
              setAppliedRegisteredStatus(registeredStatus);
              setAppliedRegisteredDateFrom(registeredDateFrom);
              setAppliedRegisteredDateTo(registeredDateTo);
            }}
            onClear={() => {
              setRegisteredKeyword('');
              setRegisteredEmail('');
              setRegisteredStatus('');
              setRegisteredDateFrom('');
              setRegisteredDateTo('');
              setAppliedRegisteredKeyword('');
              setAppliedRegisteredEmail('');
              setAppliedRegisteredStatus('');
              setAppliedRegisteredDateFrom('');
              setAppliedRegisteredDateTo('');
            }}
            onOpenSample={(sample) => openRegisteredSample(sample)}
            onRefresh={() => void loadRegistered()}
          />
        </>
      )}

      {view === 'triageResult' && triage?.status === 'ok' && (
        <TriageResultPanel
          triage={triage}
          name={name}
          onNameChange={setName}
          expectedActions={expectedActions}
          onExpectedChange={setExpectedActions}
          actualActions={actualActions}
          onActualChange={setActualActions}
          errorCode={errorCode}
          onErrorCodeChange={setErrorCode}
          triageError={triageError}
          analyzing={analyzing}
          actionError={actionError}
          onOpenSimilar={(s) => void openSimilarSample(s)}
          onRerunTriage={() => void runTriage()}
          onResolved={handleResolved}
          onUnresolved={handleUnresolved}
        />
      )}

      {view === 'unresolvedChoice' && (
        <UnresolvedChoicePanel
          actionError={actionError}
          submitting={submitting}
          onTemporarySave={() => void handleTemporarySave()}
          onOpenDetail={openDetailFormNew}
          onBack={() => setView('triageResult')}
        />
      )}

      {view === 'detailForm' && detailContext && (
        <DetailWizard
          {...wizardSharedProps}
          stepTabLabels={[
            '① 場所・種別・mail',
            '② 再現手順',
            '③ 追加情報',
          ]}
          title={
            detailMode === 'finalizeDraft' ? '一時保存の詳細入力' : '詳細を入力'
          }
          preamble={
            <div className="rounded border border-gray-200 bg-white px-4 py-3 text-sm">
              <p className="font-semibold text-gray-700">トリアージ内容（参照）</p>
              <p className="mt-2 whitespace-pre-wrap">
                <span className="text-gray-500">期待結果: </span>
                {detailContext.expected}
              </p>
              <p className="mt-2 whitespace-pre-wrap">
                <span className="text-gray-500">実際の結果: </span>
                {detailContext.actual}
              </p>
              {detailContext.error && (
                <p className="mt-2">エラーコード: {detailContext.error}</p>
              )}
            </div>
          }
          step1Content={
            <>
              {name.trim() && (
                <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  報告者名: {name}
                </p>
              )}
              <input
                type="text"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="発生場所 *"
                className="rounded border border-gray-300 px-3 py-2"
              />
              <select
                value={troubleType}
                onChange={(e) =>
                  setTroubleType(e.target.value as TroubleType | '')
                }
                className="rounded border border-gray-300 px-3 py-2"
              >
                <option value="">種別を選択 *</option>
                <option value="customer">customer</option>
                <option value="stuff">stuff</option>
              </select>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス *"
                className="rounded border border-gray-300 px-3 py-2"
              />
              <p className="text-xs text-gray-500">
                発生日時は登録時に自動で記録されます。
              </p>
            </>
          }
          submitLabel="登録する"
          submittingLabel="登録中…"
          onFormSubmit={(e) => {
            if (detailStep !== 3) {
              e.preventDefault();
              void goDetailNext();
              return;
            }
            void handleDetailSubmit(e);
          }}
          footerExtra={
            <button
              type="button"
              onClick={() => {
                if (detailMode === 'finalizeDraft') {
                  resetTriageSession();
                  loadDrafts();
                } else {
                  setView('unresolvedChoice');
                }
              }}
              className="inline-flex min-h-12 items-center rounded-lg bg-sky-600 px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-sky-700"
            >
              キャンセル
            </button>
          }
        />
      )}

      {view === 'editRegistered' && selectedRegistered && (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => void leaveRegisteredDetail()}
            className={leaveButtonClass}
          >
            {leaveButtonLabel}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              サンプル #{selectedRegistered.id}
            </h2>
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(selectedRegistered.status)}`}
            >
              ステータス: {statusLabelJa(selectedRegistered.status)}
            </span>
            {notifyUnread && (
              <span className="rounded bg-amber-600 px-2.5 py-1 text-xs font-bold text-white">
                更新あり
              </span>
            )}
          </div>
          {notifyUnread && selectedRegistered.staff_notify_summary && (
            <p className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
              {selectedRegistered.staff_notify_summary}
            </p>
          )}
          {notifyUnread && (
            <div className="rounded-lg border-2 border-amber-500 bg-amber-100 px-4 py-3">
              <p className="text-sm font-bold text-amber-950">
                未読を消す手順
              </p>
              <ol className="mt-2 space-y-1.5 text-sm text-amber-950">
                <li
                  className={
                    notifyEmailDone ? 'font-medium line-through opacity-70' : 'font-semibold'
                  }
                >
                  {notifyEmailDone ? '✓' : '1.'} 登録メールを入力する
                  {!notifyEmailDone && (
                    <span className="ml-1 font-normal">（下のメール欄）</span>
                  )}
                </li>
                {notifyNeedsReply && (
                  <li
                    className={
                      staffRepliedThisSession
                        ? 'font-medium line-through opacity-70'
                        : 'font-semibold'
                    }
                  >
                    {staffRepliedThisSession ? '✓' : '2.'}{' '}
                    対応履歴チャットで返信する
                  </li>
                )}
                <li
                  className={
                    notifyCanClear ? 'font-semibold' : 'font-medium'
                  }
                >
                  {notifyNeedsReply ? '3.' : '2.'} 「
                  {notifyCanClear ? '一覧に戻る（未読を消す）' : '一覧に戻る'}
                  」を押す
                  {notifyCanClear && (
                    <span className="ml-1 text-amber-800">← 準備完了</span>
                  )}
                </li>
              </ol>
            </div>
          )}
          <p className="text-sm text-gray-600">
            日時: {new Date(selectedRegistered.date).toLocaleString('ja-JP')}
          </p>

          {canEditRegisteredStatus(selectedRegistered.status) ? (
            <DetailWizard
              {...wizardSharedProps}
              stepTabLabels={['① 基本情報', '② 再現手順', '③ 追加情報']}
              title="内容を編集"
              step1Content={
                <>
                  <label className="flex flex-col gap-1">
                    <span className="font-semibold">
                      実施した操作と期待結果 *
                    </span>
                    <textarea
                      value={editExpected}
                      onChange={(e) => {
                        setEditExpected(e.target.value);
                        invalidateStepsApproval();
                      }}
                      rows={3}
                      className="rounded border border-gray-300 px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-semibold">
                      実施した操作と実際の結果 *
                    </span>
                    <textarea
                      value={editActual}
                      onChange={(e) => {
                        setEditActual(e.target.value);
                        invalidateStepsApproval();
                      }}
                      rows={3}
                      className="rounded border border-gray-300 px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-semibold">エラーコード（任意）</span>
                    <input
                      type="text"
                      value={editErrorCode}
                      onChange={(e) => {
                        setEditErrorCode(e.target.value);
                        invalidateStepsApproval();
                      }}
                      className="rounded border border-gray-300 px-3 py-2"
                    />
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="報告者名 *"
                    className="rounded border border-gray-300 px-3 py-2"
                  />
                  <input
                    type="text"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder="発生場所 *"
                    className="rounded border border-gray-300 px-3 py-2"
                  />
                  <select
                    value={troubleType}
                    onChange={(e) =>
                      setTroubleType(e.target.value as TroubleType | '')
                    }
                    className="rounded border border-gray-300 px-3 py-2"
                  >
                    <option value="">種別を選択 *</option>
                    <option value="customer">customer</option>
                    <option value="stuff">stuff</option>
                  </select>
                  <label className="flex flex-col gap-1">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        notifyUnread
                          ? '登録時メール（未読解除に必要）*'
                          : '登録時メール（保存・削除の確認用）*'
                      }
                      className={
                        notifyUnread && !notifyEmailDone
                          ? 'rounded border-2 border-amber-500 bg-amber-50 px-3 py-2 ring-2 ring-amber-200'
                          : 'rounded border border-gray-300 px-3 py-2'
                      }
                    />
                    {notifyUnread && !notifyEmailDone && (
                      <span className="text-xs font-semibold text-amber-800">
                        未読解除に必要です。登録時のメールを入力してください。
                      </span>
                    )}
                  </label>
                </>
              }
              submitLabel="保存"
              submittingLabel="保存中…"
              onFormSubmit={(e) => {
                if (detailStep !== 3) {
                  e.preventDefault();
                  void goDetailNext();
                  return;
                }
                void handleRegisteredSave(e);
              }}
              footerExtra={
                <>
                  {detailStep === 1 && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleRegisteredDelete()}
                      className="rounded border border-red-600 bg-white px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      削除
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void leaveRegisteredDetail()}
                    className={leaveButtonClass}
                  >
                    {leaveButtonLabel}
                  </button>
                </>
              }
            />
          ) : (
            <div className="space-y-3 rounded border border-gray-200 bg-gray-50 px-4 py-4 text-sm">
              <p className="text-gray-600">
                完全対応済みのため、内容の編集・削除はできません。
              </p>
              {notifyUnread && (
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-amber-900">
                    登録時メール（未読解除に必要）
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="登録時のメールアドレス *"
                    className={
                      !notifyEmailDone
                        ? 'rounded border-2 border-amber-500 bg-amber-50 px-3 py-2 ring-2 ring-amber-200'
                        : 'rounded border border-gray-300 px-3 py-2'
                    }
                  />
                </label>
              )}
              {selectedRegistered.actual_actions && (
                <p>
                  <span className="font-semibold text-gray-700">実際の結果: </span>
                  {selectedRegistered.actual_actions}
                </p>
              )}
              {selectedRegistered.expected_actions && (
                <p>
                  <span className="font-semibold text-gray-700">期待結果: </span>
                  {selectedRegistered.expected_actions}
                </p>
              )}
              <p>
                <span className="font-semibold text-gray-700">報告者: </span>
                {selectedRegistered.name} / {selectedRegistered.place} /{' '}
                {selectedRegistered.trouble_type}
              </p>
              {selectedRegistered.reproduction_steps &&
                selectedRegistered.reproduction_steps.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-700">再現手順</p>
                    <ol className="mt-1 list-decimal space-y-1 pl-5 text-gray-800">
                      {selectedRegistered.reproduction_steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  </div>
                )}
              {selectedRegistered.reproduction_rate && (
                <p>
                  <span className="font-semibold text-gray-700">再現率: </span>
                  {REPRODUCTION_RATE_LABELS[
                    selectedRegistered.reproduction_rate
                  ] ?? selectedRegistered.reproduction_rate}
                </p>
              )}
              {selectedRegistered.severity && (
                <p>
                  <span className="font-semibold text-gray-700">重要度: </span>
                  {SEVERITY_LABELS[selectedRegistered.severity] ??
                    selectedRegistered.severity}
                </p>
              )}
              {selectedRegistered.screenshot_path && (
                <p>
                  <span className="font-semibold text-gray-700">スクショ: </span>
                  <a
                    href={`${API_BASE_URL}${selectedRegistered.screenshot_path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline"
                  >
                    {selectedRegistered.screenshot_path}
                  </a>
                </p>
              )}
              {selectedRegistered.device_info && (
                <p className="whitespace-pre-wrap">
                  <span className="font-semibold text-gray-700">端末情報: </span>
                  {selectedRegistered.device_info}
                </p>
              )}
              <button
                type="button"
                onClick={() => void leaveRegisteredDetail()}
                className={`mt-2 ${leaveButtonClass}`}
              >
                {leaveButtonLabel}
              </button>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {canEditRegisteredStatus(selectedRegistered.status) ? (
              <SampleChat
                sampleId={selectedRegistered.id}
                mode="staff"
                ownerEmail={email}
                onStaffMessageSent={() => setStaffRepliedThisSession(true)}
                highlightReply={
                  notifyNeedsReply && notifyEmailDone && !staffRepliedThisSession
                }
              />
            ) : (
              <SampleChat
                sampleId={selectedRegistered.id}
                mode="staff"
                readOnly
              />
            )}
          </div>
        </section>
      )}
    </main>
  );
}
