"use client";

import { useEffect, useState } from "react";
import { CertificationOption, IngestResponse } from "@/features/admin/types";

export const useAdminPdfUpload = () => {
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);
  const [selectedCertificationCode, setSelectedCertificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResponse | null>(null);

  useEffect(() => {
    async function loadCertifications() {
      try {
        const response = await fetch("/api/certifications", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { certifications?: CertificationOption[] };
        const options = payload.certifications ?? [];
        setCertifications(options);

        if (options.length > 0) {
          setSelectedCertificationCode(options[0].code);
        }
      } catch {
        // Keep page usable if this request fails.
      }
    }

    void loadCertifications();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!selectedCertificationCode) {
      setError("Selecione uma certificacao antes de processar arquivos.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.delete("certificationCode");
    formData.set("certificationCode", selectedCertificationCode);

    const selectedFiles = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (selectedFiles.length === 0) {
      setError("Selecione pelo menos um arquivo PDF ou Markdown.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/pdf/ingest", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const payload = (await response.json()) as IngestResponse | { error: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Falha ao processar ingestao.");
      }

      setResult(payload);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha inesperada na ingestao.");
    } finally {
      setLoading(false);
    }
  }

  return {
    certifications,
    selectedCertificationCode,
    setSelectedCertificationCode,
    loading,
    error,
    result,
    handleSubmit,
  };
};
