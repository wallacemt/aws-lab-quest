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
  createdAt: string;
  lastSeen: string;
  _count: {
    questHistory: number;
    studyHistory: number;
  };
};

export type AdminQuestionListItem = {
  id: string;
  externalId: string;
  statement: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  usage: "KC" | "SIMULADO" | "BOTH";
  active: boolean;
  createdAt: string;
  certificationPreset: {
    code: string;
    name: string;
  } | null;
  awsService: {
    code: string;
    name: string;
  } | null;
};
