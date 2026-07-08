import type { SubmissionPayload } from '../../shared/types';
import { extractCodeFromDocument, extractLanguageFromDocument, extractProblemTitleFromDocument, extractSlugFromPathname, extractTextBySelectors } from '../extraction-utils';

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

function extractLanguage(): string {
  return extractLanguageFromDocument([
    '[data-e2e-langs-dropdown] button',
    '[data-e2e-langs-dropdown]',
    'button[id*="headlessui-listbox-button"]',
    'button[aria-haspopup="listbox"]'
  ]);
}

function extractCode(): string {
  return extractCodeFromDocument();
}

function extractDifficulty(): string {
  return extractTextBySelectors(['[data-difficulty]']) || 'Unknown';
}

export function extractLeetCodeSubmission(): SubmissionPayload | null {
  const title = extractProblemTitleFromDocument(['LeetCode']) || document.title.replace(' - LeetCode', '').trim();
  const language = extractLanguage();
  const code = extractCode();
  const problemNumber = readProblemNumberFromPage();
  const problemSlug = extractSlugFromPathname(window.location.pathname);

  if (!code) {
    return null;
  }

  return {
    platform: 'leetcode',
    title,
    slug: problemSlug || problemNumber || 'unknown',
    problemId: problemSlug || problemNumber || 'unknown',
    problemNumber: problemNumber || undefined,
    language,
    code,
    difficulty: extractDifficulty(),
    url: window.location.href,
    tags: [],
    submittedAt: new Date().toISOString(),
    source: 'leetcode',
    runtime: 'N/A',
    memory: 'N/A'
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
    const title = question?.title || document.title.replace(' - LeetCode', '').trim();
    const slug = question?.titleSlug || question?.questionFrontendId || 'unknown';

    return {
      platform: 'leetcode',
      title,
      slug,
      problemId: slug,
      problemNumber: question?.questionFrontendId,
      language: details?.lang?.name || extractLanguage(),
      code,
      difficulty: question?.difficulty || 'Unknown',
      url: window.location.href,
      tags: (question?.topicTags || []).map((tag) => tag.name || '').filter(Boolean),
      submittedAt: details?.timestamp ? new Date(Number(details.timestamp) * 1000).toISOString() : new Date().toISOString(),
      source: 'leetcode-graphql',
      runtime: details?.runtime || 'N/A',
      memory: details?.memory || 'N/A'
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
