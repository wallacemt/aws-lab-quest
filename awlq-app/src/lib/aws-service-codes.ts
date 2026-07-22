// Expand a service code to include its "Amazon X" / "AWS X" prefixed variant and vice versa,
// so that questions seeded with either form are found regardless of which name the deduped
// service list resolved to (e.g. user selects "AMAZON_EC2" but questions are tagged "EC2").
export function expandServiceCodes(codes: string[]): string[] {
  const result = new Set(codes);
  for (const code of codes) {
    // Strip prefix: "AMAZON_EC2" or "AMAZON-EC2" → "EC2"
    result.add(code.replace(/^(AMAZON|AWS)[_-]/i, ""));
    // Add prefix: "EC2" → "AMAZON_EC2"
    if (!/^(AMAZON|AWS)[_-]/i.test(code)) {
      result.add(`AMAZON_${code}`);
      result.add(`AWS_${code}`);
    }
  }
  return Array.from(result);
}
