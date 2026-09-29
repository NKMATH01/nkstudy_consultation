// 녹음 행 만들기(D6: audio_delete_after 는 INSERT 때 created_at + 30일로 확정).

import { AUDIO_RETENTION_DAYS } from "@/lib/recording/constants";
import { baseMime } from "@/lib/recording/storage";

export function computeAudioDeleteAfter(createdAt: Date): Date {
  return new Date(createdAt.getTime() + AUDIO_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export interface RecordingInsertInput {
  consultationId: string;
  mime: string;
  consentVersion: string;
  /** 동의를 확인한 직원 표시(teachers.id 또는 시스템 계정). 이름·전화번호는 넣지 않는다. */
  staffLabel: string;
  now: Date;
}

export function buildRecordingInsert(input: RecordingInsertInput) {
  const createdAt = input.now.toISOString();
  return {
    consultation_id: input.consultationId,
    status: "recording" as const,
    mime: baseMime(input.mime),
    consent_at: createdAt,
    consent_by: input.staffLabel,
    consent_version: input.consentVersion,
    created_by: input.staffLabel,
    created_at: createdAt,
    audio_delete_after: computeAudioDeleteAfter(input.now).toISOString(),
  };
}
