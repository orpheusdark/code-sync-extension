import type { EnabledPlatformKey, SubmissionPayload } from '../shared/types';

export type PlatformId = SubmissionPayload['platform'] | EnabledPlatformKey;

export interface PlatformAdapter {
  platform: PlatformId;
  detect(): boolean;
  extractSubmission(): Promise<SubmissionPayload | null>;
  injectSyncButton(): void;
  isSubmissionAccepted(): boolean;
}
