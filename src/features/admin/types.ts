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
