export type AdminStatus = {
  ready: boolean;
  admin: {
    userId: string;
    email: string;
    role: string;
  };
};

export type AdminApiError = {
  error: string;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminUserListItem = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
  accessStatus: "pending" | "approved" | "rejected";
  active: boolean;
  accessDecisionAt?: string | null;
  accessDecisionReason?: string | null;
  createdAt: string;
  lastSeen: string;
  profile: {
    certification: string;
    certificationPreset: {
      code: string;
      name: string;
    } | null;
  } | null;
  _count: {
    questHistory: number;
    studyHistory: number;
  };
};

export type AdminListSortOrder = "asc" | "desc";

export type AdminUsersListParams = {
  page: number;
  pageSize: number;
  search?: string;
  role?: string;
  accessStatus?: "pending" | "approved" | "rejected";
  active?: "true" | "false";
  certificationCode?: string;
  createdFrom?: string;
  createdTo?: string;
  lastSeenFrom?: string;
  lastSeenTo?: string;
  sortBy?: "createdAt" | "lastSeen" | "name" | "email" | "role";
  sortOrder?: AdminListSortOrder;
};

export type AdminUserUpdatePayload = {
  name?: string;
  role?: string;
  accessStatus?: "pending" | "approved" | "rejected";
  accessDecisionReason?: string;
  active?: boolean;
};

export type AdminQuestionsListParams = {
  page: number;
  pageSize: number;
  search?: string;
  difficulty?: "easy" | "medium" | "hard";
  questionType?: "single" | "multi";
  usage?: "KC" | "SIMULADO" | "BOTH";
  active?: "true" | "false";
  certificationCode?: string;
  awsServiceCode?: string;
  reportStatus?: "REPORTED" | "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  sortBy?: "createdAt" | "difficulty" | "usage" | "topic" | "externalId" | "active" | "questionType";
  sortOrder?: AdminListSortOrder;
};

export type AdminQuestionListItem = {
  id: string;
  externalId: string;
  statement: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionType: "single" | "multi";
  usage: "KC" | "SIMULADO" | "BOTH";
  active: boolean;
  correctOption: string;
  correctOptions?: string[] | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  explanationA: string | null;
  explanationB: string | null;
  explanationC: string | null;
  explanationD: string | null;
  explanationE: string | null;
  options?: Array<{
    label: "A" | "B" | "C" | "D" | "E";
    content: string | null;
    explanation: string | null;
    isCorrect: boolean;
  }>;
  createdAt: string;
  certificationPreset: {
    code: string;
    name: string;
  } | null;
  awsService: {
    code: string;
    name: string;
  } | null;
  awsServices?: Array<{
    code: string;
    name: string;
  }>;
  reportCount?: number;
  openReportCount?: number;
};

export type AdminQuestionUpdatePayload = {
  statement?: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  questionType?: "single" | "multi";
  usage?: "KC" | "SIMULADO" | "BOTH";
  active?: boolean;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  optionE?: string | null;
  correctOption?: string;
  correctOptions?: string[] | null;
  explanationA?: string | null;
  explanationB?: string | null;
  explanationC?: string | null;
  explanationD?: string | null;
  explanationE?: string | null;
  options?: Array<{
    label?: "A" | "B" | "C" | "D" | "E";
    content?: string | null;
    explanation?: string | null;
    isCorrect?: boolean;
  }>;
  serviceCodes?: string[] | null;
};

export type AdminQuestionReportListParams = {
  page: number;
  pageSize: number;
  status?: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
};

export type AdminQuestionReportListItem = {
  id: string;
  reason:
    | "INCORRECT_ANSWER"
    | "UNCLEAR_STATEMENT"
    | "MISSING_CONTEXT"
    | "GRAMMAR_TYPO"
    | "DUPLICATE"
    | "QUALITY_ISSUE"
    | "OTHER";
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  description: string | null;
  reportedAt: string;
  reviewedAt: string | null;
  reporter: {
    id: string;
    name: string;
    username: string | null;
    imageUrl: string | null;
  };
};

export type AdminQuestionReportUpdatePayload = {
  status: "RESOLVED" | "DISMISSED";
  reviewNotes?: string;
};

export type AdminQuestionReportUpdateResult = {
  report: {
    id: string;
    status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
    reviewedAt: string | null;
    reviewNotes: string | null;
  };
  question: {
    id: string;
    reportCount: number;
    openReportCount: number;
  };
};

export type AdminQuestionsBatchAction = "set-active" | "set-usage" | "delete";

export type AdminQuestionsBatchPayload = {
  ids: string[];
  action: AdminQuestionsBatchAction;
  active?: boolean;
  usage?: "KC" | "SIMULADO" | "BOTH";
};

export type AdminQuestionsBatchResult = {
  ok: boolean;
  action: AdminQuestionsBatchAction;
  requested: number;
  affected: number;
};

export type AdminQuestionsFillMissingPayload = {
  // Backward compatibility (old UI sent batchSize only).
  batchSize?: number;
  totalToProcess?: number;
  chunkSize?: number;
  delayMs?: number;
  dryRun?: boolean;
};

export type AdminQuestionsFillMissingResult = {
  ok: boolean;
  batchSize: number;
  requestedTotal?: number;
  processed: number;
  updated: number;
  touched?: number;
  aiRequests?: number;
  pendingBefore?: number;
  pendingAfter?: number;
  delayMs?: number;
  dryRun: boolean;
  message?: string;
  details: Array<{
    id: string;
    externalId: string;
    attempted?: boolean;
    topicUpdated: boolean;
    servicesUpdated: boolean;
    topic: string;
    serviceCodes: string[];
    note?: string;
  }>;
};

export type AdminQuestionsFillMissingStats = {
  ok: boolean;
  pending: number;
  defaultChunkSize: number;
  maxChunkSize: number;
  defaultDelayMs: number;
  maxTotalPerRun: number;
};

export type AdminQuestionsCleanupPayload = {
  scanned: number;
  irregularCount: number;
  removedCount: number;
  dryRun: boolean;
  sample: Array<{
    id: string;
    externalId: string;
    reasons: string[];
  }>;
};

export type AdminMetricsOverview = {
  totals: {
    users: number;
    questions: number;
    studySessions: number;
  };
  averageScorePercent: number;
  passRatePercent: number;
};

export type AdminTimelinePoint = {
  date: string;
  users: number;
  sessions: number;
};

export type AdminQuestionDistribution = {
  byDifficulty: Array<{ label: string; count: number }>;
  byUsage: Array<{ label: string; count: number }>;
  byCertification: Array<{ label: string; count: number }>;
};

export type AdminWeakServiceItem = {
  serviceCode: string;
  serviceName: string;
  attempts: number;
  errors: number;
  errorRate: number;
};

export type AdminXpRankingItem = {
  userId: string;
  userName: string;
  totalXp: number;
};

export type AdminMetricsPayload = {
  overview: AdminMetricsOverview;
  timeline: AdminTimelinePoint[];
  distribution: AdminQuestionDistribution;
  weakServices: AdminWeakServiceItem[];
  ranking: AdminXpRankingItem[];
};

export type AdminUploadType = "EXAM_GUIDE" | "SIMULADO_PDF" | "SIMULADO_GENERATION";

export type AdminUploadedFileItem = {
  id: string;
  uploadType: AdminUploadType;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageBucket: string;
  storagePath: string;
  sha256: string;
  source: string;
  createdAt: string;
  certificationPreset: {
    code: string;
    name: string;
  } | null;
  uploadedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  _count: {
    generatedQuestions: number;
  };
};

export type AdminUploadJobItem = {
  id: string;
  status: "PENDING" | "UPLOADING" | "EXTRACTING" | "GENERATING" | "SAVING" | "COMPLETED" | "FAILED";
  uploadType: AdminUploadType;
  progressPercent: number;
  message: string | null;
  generatedCount: number | null;
  savedCount: number | null;
  errorMessage: string | null;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  certificationPreset: {
    code: string;
    name: string;
  } | null;
  uploadedFile: {
    id: string;
    fileName: string;
  } | null;
};

export type AdminUploadsListParams = {
  page: number;
  pageSize: number;
  search?: string;
  uploadType?: AdminUploadType | "";
  certificationCode?: string;
  limit?: number;
};

export type AdminUploadsPayload = {
  files: AdminUploadedFileItem[];
  filesPagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  recentJobs: AdminUploadJobItem[];
  recentJobsLimit: number;
};

export type AdminUploadSignedUrlPayload = {
  file: {
    id: string;
    fileName: string;
    storageBucket: string;
    storagePath: string;
    uploadType: AdminUploadType;
    createdAt: string;
  };
  signedUrl: string;
  expiresInSeconds: number;
};

export type AdminUploadGeneratedQuestionItem = {
  id: string;
  externalId: string;
  statement: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionType: "single" | "multi";
  usage: "KC" | "SIMULADO" | "BOTH";
  correctOption: string;
  correctOptions?: string[] | null;
  createdAt: string;
};

export type AdminUploadQuestionsPayload = {
  uploadedFile: {
    id: string;
    fileName: string;
    uploadType: AdminUploadType;
    certificationPreset: {
      code: string;
      name: string;
    } | null;
  };
  items: AdminUploadGeneratedQuestionItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminEmailTemplateItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  subject: string;
  html: string;
  text: string | null;
  active: boolean;
  isSystem: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminEmailTemplateCreatePayload = {
  code: string;
  name: string;
  description?: string;
  subject: string;
  html: string;
  text?: string;
  active?: boolean;
};

export type AdminEmailTemplateUpdatePayload = {
  name?: string;
  description?: string;
  subject?: string;
  html?: string;
  text?: string;
  active?: boolean;
};

export type AdminEmailSendPayload = {
  templateId: string;
  targetMode: "all-users" | "single-user";
  userId?: string;
};

export type CertificationOption = {
  id: string;
  code: string;
  name: string;
};

export type ExtractionResponse = {
  jobId: string;
  uploadedFileId: string;
  fileName: string;
  characters: number;
  preview: string;
  extractedText: string;
  certification: {
    code: string;
    name: string;
  };
};

export type IngestResponse = {
  jobId: string;
  certificationCode: string;
  generatedCount: number;
  savedCount: number;
  duplicateCount?: number;
  rejectedCount?: number;
  rejectionReasons?: Record<string, number>;
  extractedQuestions?: Array<{
    id: string;
    usageHash: string;
    rawText: string;
    statement: string;
    options: Array<{
      content: string;
      isCorrect: boolean;
    }>;
    explanation: string | null;
    awsServices: string[];
    topics: string[];
  }>;
  rejects?: Array<{
    fileName: string;
    blockId?: number;
    reason: string;
    detail: string;
  }>;
};

export type ExamGuideResponse = {
  uploadedFileId: string | null;
  fileName: string;
  characters: number;
  preview: string;
  message: string;
  certification: {
    code: string;
    name: string;
  };
  conflict?: {
    certificationCode: string;
    certificationName: string;
    updatedAt: string;
  };
};

export type ApiErrorResponse = {
  error: string;
  conflict?: {
    certificationCode: string;
    certificationName: string;
    updatedAt: string;
  };
};

export type UploadMode = "exam-guide" | "simulado" | "simulado-completo";

export type IngestionJobResponse = {
  job: {
    id: string;
    status: "PENDING" | "UPLOADING" | "EXTRACTING" | "GENERATING" | "SAVING" | "COMPLETED" | "FAILED";
    uploadType: "EXAM_GUIDE" | "SIMULADO_PDF" | "SIMULADO_GENERATION";
    fileName: string | null;
    progressPercent: number;
    message: string | null;
    generatedCount: number | null;
    savedCount: number | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type ExamGuideStatusItem = {
  id: string;
  code: string;
  name: string;
  hasExamGuide: boolean;
  updatedAt: string;
  latestUpload: {
    id: string;
    fileName: string;
    createdAt: string;
    uploadedBy: {
      name: string | null;
      email: string;
    } | null;
  } | null;
};

export type UploadDashboardPayload = AdminUploadsPayload;

export type UploadAction = "exam-guide" | "simulado" | "simulado-completo";

export type SimuladoQueueItem = {
  id: string;
  fileName: string;
  status: "PENDING" | "EXTRACTING" | "INGESTING" | "COMPLETED" | "FAILED";
  generatedCount?: number;
  savedCount?: number;
  rejectedCount?: number;
  error?: string;
};
