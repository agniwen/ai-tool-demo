export interface InterviewTurn {
  role: 'agent' | 'user'
  message: string
  timeInCallSecs?: number
}

export interface InterviewReport {
  conversationId: string
  agentId?: string
  status?: string
  callSuccessful?: string
  transcriptSummary?: string
  evaluationCriteriaResults: Record<string, unknown>
  dataCollectionResults: Record<string, unknown>
  transcript: InterviewTurn[]
  receivedAt: number
}

const MAX_REPORTS = 300;

const reportStore = new Map<string, InterviewReport>();

export function saveInterviewReport(report: InterviewReport) {
  reportStore.set(report.conversationId, report);

  if (reportStore.size <= MAX_REPORTS) {
    return;
  }

  const staleKeys = [...reportStore.keys()].slice(0, reportStore.size - MAX_REPORTS);

  for (const key of staleKeys) {
    reportStore.delete(key);
  }
}

export function getInterviewReport(conversationId: string) {
  return reportStore.get(conversationId) ?? null;
}
