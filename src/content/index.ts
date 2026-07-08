import type { SubmissionPayload } from '../shared/types';

type ButtonState = 'idle' | 'loading' | 'success' | 'failure' | 'duplicate';

type SyncResult = {
  ok?: boolean;
  result?: { status?: 'success' | 'duplicate'; message?: string; filePath?: string };
  reason?: string;
};

const MESSAGE_TYPES = {
  SYNC_SUBMISSION: 'SYNC_SUBMISSION'
} as const;

let syncButton: FloatingSyncButton | null = null;
let currentLocation = '';

class FloatingSyncButton {
  private readonly host = document.createElement('div');
  private readonly shadow: ShadowRoot;
  private readonly button: HTMLButtonElement;
  private readonly toast: HTMLDivElement;
  private readonly labelElement: HTMLSpanElement;
  private readonly leftIcon: HTMLSpanElement;
  private readonly rightIcon: HTMLSpanElement;
  private resetTimer: number | null = null;
  private mounted = false;

  constructor(private readonly onClick: () => Promise<void> | void, initialLabel: string) {
    this.host.id = 'codesync-floating-button-host';
    this.host.style.all = 'initial';
    this.host.style.position = 'fixed';
    this.host.style.right = '18px';
    this.host.style.bottom = '18px';
    this.host.style.zIndex = '2147483647';
    this.host.style.pointerEvents = 'auto';

    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = `
      <style>
        :host {
          color-scheme: light dark;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; pointer-events: none; }
        .toast {
          pointer-events: none;
          opacity: 0;
          transform: translateY(8px) scale(0.98);
          transition: opacity 180ms ease, transform 180ms ease;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(17, 24, 39, 0.92);
          color: #f9fafb;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
          max-width: min(320px, calc(100vw - 32px));
          font-size: 12px;
          line-height: 1.4;
          white-space: pre-line;
        }
        :host([data-theme='light']) .toast { background: rgba(255, 255, 255, 0.96); color: #111827; border-color: rgba(15, 23, 42, 0.1); }
        .toast.visible { opacity: 1; transform: translateY(0) scale(1); }
        .button {
          pointer-events: auto;
          display: inline-flex; align-items: center; gap: 10px;
          border: none; border-radius: 16px; padding: 12px 16px; min-height: 48px;
          font-size: 14px; font-weight: 700; cursor: pointer; color: #f9fafb;
          background: linear-gradient(135deg, #0f172a, #1f2937);
          box-shadow: 0 16px 35px rgba(15, 23, 42, 0.26);
          border: 1px solid rgba(255, 255, 255, 0.12);
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease, background 160ms ease;
          backdrop-filter: blur(14px);
        }
        .button:hover { transform: translateY(-2px); box-shadow: 0 18px 42px rgba(15, 23, 42, 0.32); }
        .button:active { transform: translateY(0); }
        .button[data-state='loading'] { cursor: progress; opacity: 0.95; }
        .button[data-state='success'] { background: linear-gradient(135deg, #15803d, #166534); }
        .button[data-state='failure'] { background: linear-gradient(135deg, #b91c1c, #991b1b); }
        .button[data-state='duplicate'] { background: linear-gradient(135deg, #0f766e, #115e59); }
        .icon-row { display: inline-flex; align-items: center; gap: 8px; }
        .icon { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; color: currentColor; flex: 0 0 auto; }
        .label { letter-spacing: 0.01em; }
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.28); border-top-color: currentColor; border-radius: 999px; animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 640px) { .button { padding: 11px 14px; min-height: 44px; } }
        @media (prefers-reduced-motion: reduce) { .button, .toast { transition: none; } .spinner { animation: none; } }
      </style>
      <div class="wrap">
        <div class="toast" id="toast"></div>
        <button class="button" id="button" type="button" data-state="idle" aria-label="${initialLabel}">
          <span class="icon-row">
            <span class="icon" id="leftIcon"></span>
            <span class="icon" id="rightIcon"></span>
            <span class="label" id="label"></span>
          </span>
        </button>
      </div>
    `;

    const button = this.shadow.getElementById('button');
    const labelElement = this.shadow.getElementById('label');
    const leftIcon = this.shadow.getElementById('leftIcon');
    const rightIcon = this.shadow.getElementById('rightIcon');
    const toast = this.shadow.getElementById('toast');

    if (!button || !labelElement || !leftIcon || !rightIcon || !toast) {
      throw new Error('Unable to initialize floating sync button.');
    }

    this.button = button as HTMLButtonElement;
    this.labelElement = labelElement as HTMLSpanElement;
    this.leftIcon = leftIcon as HTMLSpanElement;
    this.rightIcon = rightIcon as HTMLSpanElement;
    this.toast = toast as HTMLDivElement;

    this.setState('idle', initialLabel);
    this.button.addEventListener('click', () => { void this.onClick(); });
  }

  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    document.body.appendChild(this.host);
    this.syncTheme();
  }

  destroy(): void {
    if (this.resetTimer) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.host.remove();
    this.mounted = false;
  }

  setState(state: ButtonState, label?: string): void {
    this.button.dataset.state = state;
    this.button.disabled = state === 'loading';
    this.labelElement.textContent = label || getStateLabel(state);

    if (state === 'loading') {
      this.leftIcon.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
      this.rightIcon.innerHTML = '';
      return;
    }

    this.leftIcon.innerHTML = githubIconSvg();
    this.rightIcon.innerHTML = state === 'duplicate' ? checkIconSvg() : syncIconSvg();
  }

  showToast(message: string, variant: 'success' | 'error' | 'duplicate' | 'info' = 'info'): void {
    this.toast.textContent = message;
    this.toast.dataset.variant = variant;
    this.toast.classList.add('visible');

    if (this.resetTimer) window.clearTimeout(this.resetTimer);
    this.resetTimer = window.setTimeout(() => {
      this.toast.classList.remove('visible');
      this.resetTimer = null;
    }, 2600);
  }

  syncTheme(): void {
    this.host.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}

function getStateLabel(state: ButtonState): string {
  switch (state) {
    case 'loading': return 'Syncing...';
    case 'success': return '✓ Synced';
    case 'failure': return 'Retry';
    case 'duplicate': return 'Already Synced';
    default: return 'Sync Now';
  }
}

function githubIconSvg(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.54 5.47 7.59.4.08.55-.17.55-.38v-1.3c-2.22.48-2.69-1.06-2.69-1.06-.36-.92-.89-1.16-.89-1.16-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.53.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.95c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .22.15.47.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
    </svg>
  `;
}

function syncIconSvg(): string {
  return `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2.5 8a5.5 5.5 0 0 1 9.67-3.58"/>
      <path d="M12 3v2.5h-2.5"/>
      <path d="M13.5 8A5.5 5.5 0 0 1 3.83 11.58"/>
      <path d="M4 13v-2.5h2.5"/>
    </svg>
  `;
}

function checkIconSvg(): string {
  return `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5"/>
    </svg>
  `;
}

function isSupportedLeetCodeProblemPage(): boolean {
  return /(^|\.)leetcode\.com$/.test(window.location.hostname) && /^\/problems\/[^/]+(?:\/|$)/.test(window.location.pathname);
}

function hasAcceptedSubmission(): boolean {
  const bodyText = document.body?.innerText ?? '';
  return /\baccepted\b/i.test(bodyText) || /submission accepted/i.test(bodyText) || /status\s*[:\-]\s*accepted/i.test(bodyText);
}

function isSubmissionResultPage(): boolean {
  return /\/submissions\/(?:detail\/)?\d+/.test(window.location.pathname);
}

function readCookie(name: string): string {
  const cookies = document.cookie.split(';').map((value) => value.trim());
  const prefix = `${name}=`;
  const match = cookies.find((value) => value.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : '';
}

function readProblemNumberFromPage(): string {
  const candidates = [
    document.querySelector('[data-cy="question-title"]')?.textContent?.trim() ?? '',
    document.title.replace(' - LeetCode', '').trim(),
    (window as Window & { __NEXT_DATA__?: unknown }).__NEXT_DATA__ ? JSON.stringify((window as Window & { __NEXT_DATA__?: unknown }).__NEXT_DATA__) : '',
    document.documentElement.innerHTML
  ];

  for (const candidate of candidates) {
    const match = candidate.match(/(?:questionFrontendId|frontendQuestionId|question_number|questionNumber|titleSlug|problemId)["'\s:=,>]*([0-9]{1,5})/i) || candidate.match(/\b(\d{1,5})\.\s+[A-Z]/);
    if (match?.[1]) return match[1];
  }

  return '';
}

function readProblemTitleFromPage(): string {
  const titleText = document.querySelector('[data-cy="question-title"]')?.textContent?.trim();
  if (titleText) {
    const parsed = titleText.replace(/^\d+[.)\-:]\s*/, '').trim();
    if (parsed) return parsed;
  }

  const documentTitle = document.title.replace(' - LeetCode', '').trim();
  if (documentTitle) return documentTitle.replace(/^\d+[.)\-:]\s*/, '').trim();

  return '';
}

function extractLanguage(): string {
  const selectors = [
    '[data-e2e-langs-dropdown] button',
    '[data-e2e-langs-dropdown]',
    'button[id*="headlessui-listbox-button"]',
    'button[aria-haspopup="listbox"]'
  ];

  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text && text.length < 40) return text;
  }

  return 'Unknown';
}

function extractCode(): string {
  const candidates = [
    Array.from(document.querySelectorAll('pre code'))
      .map((node) => node.textContent?.trim() ?? '')
      .filter(Boolean)
      .join('\n\n'),
    Array.from(document.querySelectorAll('.monaco-editor .view-lines .view-line'))
      .map((line) => line.textContent ?? '')
      .join('\n')
      .trim(),
    (document.querySelector('.cm-content')?.textContent ?? '').trim()
  ];

  for (const candidate of candidates) {
    if (looksLikeSolutionCode(candidate)) {
      return candidate;
    }
  }

  const textAreaValue = (document.querySelector('textarea') as HTMLTextAreaElement | null)?.value?.trim() ?? '';
  if (looksLikeSolutionCode(textAreaValue)) {
    return textAreaValue;
  }

  return '';
}

function looksLikeSolutionCode(code: string): boolean {
  const normalized = code.trim();
  if (!normalized || normalized.length < 12) {
    return false;
  }

  if (/^[\d\s,.;:+\-*/()\[\]{}=<>|&'"`_]+$/.test(normalized)) {
    return false;
  }

  return /(^|\n)\s*(class\s+\w+|def\s+\w+\s*\(|function\s+\w+\s*\(|public\s+(class|static|void)|private\s+(class|static|void)|#include\s*<|using\s+namespace\s+std|package\s+main|var\s+\w+|let\s+\w+|const\s+\w+|if\s+__name__\s*==\s*['"]__main__['"])/.test(normalized) || /[{};]/.test(normalized) || /\breturn\b/.test(normalized);
}

function extractLeetCodeSubmission(): SubmissionPayload | null {
  const title = readProblemTitleFromPage() || document.title.replace(' - LeetCode', '');
  const language = extractLanguage();
  const code = extractCode();
  const problemNumber = readProblemNumberFromPage();
  const problemSlug = window.location.pathname.match(/problems\/([^/]+)/)?.[1] ?? '';

  if (!code) return null;

  return {
    platform: 'leetcode',
    problemId: problemSlug || problemNumber || 'unknown',
    problemNumber: problemNumber || undefined,
    problemSlug: problemSlug || undefined,
    title,
    difficulty: document.querySelector('[data-difficulty]')?.textContent?.trim() ?? 'Unknown',
    language,
    code,
    runtime: 'N/A',
    memory: 'N/A',
    tags: [],
    url: window.location.href,
    submittedAt: new Date().toISOString(),
    source: 'leetcode'
  };
}

async function extractLeetCodeSubmissionFromGraphQL(): Promise<SubmissionPayload | null> {
  const submissionIdMatch = window.location.pathname.match(/submissions(?:\/detail)?\/(\d+)/);
  const submissionId = Number(submissionIdMatch?.[1] ?? 0);
  if (!submissionId) return null;

  try {
    const response = await fetch('/graphql/', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrftoken': readCookie('csrftoken')
      },
      body: JSON.stringify({
        operationName: 'submissionDetails',
        query: 'query submissionDetails($submissionId: Int!) { submissionDetails(submissionId: $submissionId) { code runtime memory timestamp statusDisplay lang { name } question { title titleSlug difficulty questionFrontendId topicTags { name } } } }',
        variables: { submissionId }
      })
    });

    if (!response.ok) return null;

    const data = await response.json() as { data?: { submissionDetails?: { code?: string; runtime?: string; memory?: string; timestamp?: string; statusDisplay?: string; lang?: { name?: string }; question?: { title?: string; titleSlug?: string; difficulty?: string; questionFrontendId?: string; topicTags?: Array<{ name?: string }> } } } };
    const details = data.data?.submissionDetails;
    const statusDisplay = details?.statusDisplay?.toLowerCase().trim() ?? '';
    if (statusDisplay && statusDisplay !== 'accepted') {
      return null;
    }

    const code = details?.code?.trim() ?? '';
    if (!code) return null;

    const question = details?.question;
    return {
      platform: 'leetcode',
      problemId: question?.titleSlug || question?.questionFrontendId || 'unknown',
      problemNumber: question?.questionFrontendId,
      problemSlug: question?.titleSlug,
      title: question?.title || document.title.replace(' - LeetCode', ''),
      difficulty: question?.difficulty || 'Unknown',
      language: details?.lang?.name || extractLanguage(),
      code,
      runtime: details?.runtime || 'N/A',
      memory: details?.memory || 'N/A',
      tags: (question?.topicTags || []).map((tag) => tag.name || '').filter(Boolean),
      url: window.location.href,
      submittedAt: details?.timestamp ? new Date(Number(details.timestamp) * 1000).toISOString() : new Date().toISOString(),
      source: 'leetcode-graphql'
    };
  } catch {
    return null;
  }
}

async function resolveProblemNumberFromSlug(problemSlug: string): Promise<string> {
  if (!problemSlug) {
    return '';
  }

  try {
    const response = await fetch('/graphql/', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrftoken': readCookie('csrftoken')
      },
      body: JSON.stringify({
        operationName: 'questionData',
        query: 'query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { questionFrontendId title titleSlug } }',
        variables: { titleSlug: problemSlug }
      })
    });

    if (!response.ok) {
      return '';
    }

    const data = await response.json() as { data?: { question?: { questionFrontendId?: string } } };
    return data.data?.question?.questionFrontendId || '';
  } catch {
    return '';
  }
}

async function extractLeetCodeSubmissionWithFallback(): Promise<SubmissionPayload | null> {
  const direct = extractLeetCodeSubmission();
  if (direct) {
    if (!direct.problemNumber && direct.problemSlug) {
      direct.problemNumber = await resolveProblemNumberFromSlug(direct.problemSlug);
    }
    return direct;
  }

  const graphqlSubmission = await extractLeetCodeSubmissionFromGraphQL();
  if (graphqlSubmission) {
    if (!graphqlSubmission.problemNumber && graphqlSubmission.problemSlug) {
      graphqlSubmission.problemNumber = await resolveProblemNumberFromSlug(graphqlSubmission.problemSlug);
    }
    return graphqlSubmission;
  }

  return null;
}

function ensureLeetCodeMetadata(payload: SubmissionPayload): SubmissionPayload {
  const titleText = payload.title.replace(/^\d+[.)\-:]\s*/, '').trim();
  const numberFromTitle = payload.title.match(/^(\d{1,5})[.)\-:]\s*/)?.[1];
  const numberFromUrl = window.location.pathname.match(/problems\/([^/]+)/)?.[1] ?? '';
  const problemNumber = payload.problemNumber || numberFromTitle || numberFromUrl.match(/\d+/)?.[0] || '';
  const problemSlug = payload.problemSlug || numberFromUrl || payload.problemId;

  return {
    ...payload,
    title: titleText || payload.title,
    problemNumber: problemNumber || undefined,
    problemSlug: problemSlug || undefined,
    source: 'leetcode'
  };
}

function setButtonState(state: ButtonState, label?: string): void {
  syncButton?.setState(state, label);
}

function showToast(message: string, variant: 'success' | 'error' | 'duplicate' | 'info' = 'info'): void {
  syncButton?.showToast(message, variant);
}

function resetButtonSoon(): void {
  window.setTimeout(() => {
    if (isSupportedLeetCodeProblemPage()) {
      setButtonState('idle');
    }
  }, 2400);
}

async function syncCurrentSolution(): Promise<void> {
  if (!hasAcceptedSubmission() && !isSubmissionResultPage()) {
    setButtonState('failure');
    showToast('Submit an accepted solution first.', 'error');
    resetButtonSoon();
    return;
  }

  setButtonState('loading');

  try {
    const payload = await extractLeetCodeSubmissionWithFallback();
    if (!payload) {
      setButtonState('failure');
      showToast('Unable to read the submitted code from this page.', 'error');
      resetButtonSoon();
      return;
    }

    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SYNC_SUBMISSION, payload: ensureLeetCodeMetadata(payload) }) as SyncResult | undefined;

    if (!response?.ok || !response.result) {
      setButtonState('failure');
      showToast(response?.reason || 'Failed to sync.', 'error');
      resetButtonSoon();
      return;
    }

    if (response.result.status === 'duplicate') {
      setButtonState('duplicate');
      showToast(`${response.result.message || 'Already synced'}\n${response.result.filePath || ''}`, 'duplicate');
    } else {
      setButtonState('success');
      showToast(`${response.result.message || 'Synced successfully'}\n${response.result.filePath || ''}`, 'success');
    }

    resetButtonSoon();
  } catch {
    setButtonState('failure');
    showToast('Failed to sync.', 'error');
    resetButtonSoon();
  }
}

function mountButton(): void {
  if (syncButton) {
    syncButton.destroy();
  }

  syncButton = new FloatingSyncButton(() => {
    void syncCurrentSolution();
  }, 'Sync Now');

  syncButton.mount();
  syncButton.syncTheme();
  setButtonState('idle');
}

function unmountButton(): void {
  syncButton?.destroy();
  syncButton = null;
}

function refreshButtonVisibility(): void {
  const locationKey = window.location.href;
  if (locationKey === currentLocation) return;

  currentLocation = locationKey;

  if (isSupportedLeetCodeProblemPage()) {
    mountButton();
  } else {
    unmountButton();
  }
}

function installNavigationWatcher(): void {
  const pushState = history.pushState;
  const replaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = pushState.apply(this, args as Parameters<typeof history.pushState>);
    queueMicrotask(refreshButtonVisibility);
    return result;
  };

  history.replaceState = function (...args) {
    const result = replaceState.apply(this, args as Parameters<typeof history.replaceState>);
    queueMicrotask(refreshButtonVisibility);
    return result;
  };

  window.addEventListener('popstate', refreshButtonVisibility);
}

refreshButtonVisibility();
installNavigationWatcher();
