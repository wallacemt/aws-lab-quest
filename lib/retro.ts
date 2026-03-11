export const RETRO_AWS_SERVICES = ["EC2", "S3", "Lambda", "IAM", "VPC", "CloudFront", "RDS", "CloudWatch"];

export function extractBoardTitle(labText: string): string {
  const firstLine =
    labText
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ?? "Suas Missoes";
  return firstLine.slice(0, 70);
}
