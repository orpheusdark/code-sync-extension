import type { SubmissionPayload } from '../../shared/types';

interface LeetCodeSubmissionDetailsResponse {
  data?: {
    submissionDetails?: {
      code?: string;
      import type { SubmissionPayload } from '../../shared/types';

      interface LeetCodeSubmissionDetailsResponse {
        data?: {
          submissionDetails?: {
            code?: string;
            runtime?: string;
            memory?: string;
            timestamp?: string;
            statusDisplay?: string;
            lang?: {
              name?: string;
            };
            question?: {
              title?: string;
              titleSlug?: string;
              difficulty?: string;
              questionFrontendId?: string;
              topicTags?: Array<{ name?: string }>;
            };
          };
        };
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
          if (match?.[1]) {
            return match[1];
          }
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
          if (text && text.length < 40) {
            return text;
          }
        }

        return 'Unknown';
      }

      function extractCode(): string {
        const candidates = [
          Array.from(document.querySelectorAll('pre code')).map((node) => node.textContent?.trim() ?? '').filter(Boolean).join('\n\n'),
          Array.from(document.querySelectorAll('.monaco-editor .view-lines .view-line')).map((line) => line.textContent ?? '').join('\n').trim(),
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

      export function extractLeetCodeSubmission(): SubmissionPayload | null {
        const title = readProblemTitleFromPage() || document.title.replace(' - LeetCode', '');
        const language = extractLanguage();
        const code = extractCode();
        const problemNumber = readProblemNumberFromPage();
        const problemSlug = window.location.pathname.match(/problems\/([^/]+)/)?.[1] ?? '';

        if (!code) {
          return null;
        }

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

      export async function extractLeetCodeSubmissionFromGraphQL(): Promise<SubmissionPayload | null> {
        const submissionIdMatch = window.location.pathname.match(/submissions(?:\/detail)?\/(\d+)/);
        const submissionId = Number(submissionIdMatch?.[1] ?? 0);
        if (!submissionId) {
          return null;
        }

        try {
          const csrfToken = readCookie('csrftoken');
          const response = await fetch('/graphql/', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-csrftoken': csrfToken
            },
            body: JSON.stringify({
              operationName: 'submissionDetails',
              query: 'query submissionDetails($submissionId: Int!) { submissionDetails(submissionId: $submissionId) { code runtime memory timestamp statusDisplay lang { name } question { title titleSlug difficulty questionFrontendId topicTags { name } } } }',
              variables: { submissionId }
            })
          });

          if (!response.ok) {
            return null;
          }

          const data = await response.json() as LeetCodeSubmissionDetailsResponse;
          const details = data.data?.submissionDetails;
          const statusDisplay = details?.statusDisplay?.toLowerCase().trim() ?? '';
          if (statusDisplay && statusDisplay !== 'accepted') {
            return null;
          }

          const code = details?.code?.trim() ?? '';
          if (!code) {
            return null;
          }

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

      export async function extractLeetCodeSubmissionWithFallback(): Promise<SubmissionPayload | null> {
        const direct = extractLeetCodeSubmission();
        if (direct) {
          return direct;
        }

        return extractLeetCodeSubmissionFromGraphQL();
      }
