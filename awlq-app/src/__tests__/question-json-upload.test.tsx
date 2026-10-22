// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuestionJsonUpload } from "@/features/admin/components/QuestionJsonUpload";
const question = { statement: "Service?", options: { A: "S3", B: "EC2" }, correctOption: "A" };
const file = (value: unknown, name = "questions.json") => ({ name, size: 100, text: async () => JSON.stringify(value) });
afterEach(cleanup);
describe("JSON file upload", () => {
  it("validates a selected file without requiring pasted JSON", async () => {
    const onChange = vi.fn(); render(<QuestionJsonUpload onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Arquivo JSON/), { target: { files: [file([question])] } });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([question]));
    expect(screen.getByRole("status").textContent).toContain("1 questões válidas");
  });
  it("clears previous selection and exposes validation errors", async () => {
    const onChange = vi.fn(); render(<QuestionJsonUpload onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Arquivo JSON/), { target: { files: [file([null])] } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Item 1"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });
  it("enforces maker question counts before enabling review", async () => {
    const onChange = vi.fn(); render(<QuestionJsonUpload onChange={onChange} min={20} max={65} />);
    fireEvent.change(screen.getByLabelText(/Arquivo JSON/), { target: { files: [file([question])] } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("20 a 65"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });
  it("ignores a stale file read after a newer selection", async () => {
    let finish!: (value: string) => void;
    const first = { name: "first.json", size: 10, text: () => new Promise<string>(resolve => { finish = resolve; }) };
    const onChange = vi.fn(); render(<QuestionJsonUpload onChange={onChange} />);
    const input = screen.getByLabelText(/Arquivo JSON/);
    fireEvent.change(input, { target: { files: [first] } });
    fireEvent.change(input, { target: { files: [file([question])] } });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([question]));
    finish(JSON.stringify([null]));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(onChange).toHaveBeenLastCalledWith([question]);
  });
});
