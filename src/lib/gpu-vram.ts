const PER_GPU_VRAM_GB: Record<string, number> = {
  "H100 SXM": 80,
  "H100 PCIe": 80,
  "H200": 141,
  "B200": 192,
  "A100 80GB": 80,
  "A100 40GB": 40,
  "L40S": 48,
  "L40": 48,
  "RTX 4090": 24,
  "RTX 6000 Ada": 48,
  "RTX A6000": 48,
};

export function perGpuVram(model: string): number | undefined {
  return PER_GPU_VRAM_GB[model];
}

export function inferGpuCount(model: string, totalVramGb: number): number {
  const per = perGpuVram(model);
  if (!per) return 1;
  return Math.max(1, Math.round(totalVramGb / per));
}
