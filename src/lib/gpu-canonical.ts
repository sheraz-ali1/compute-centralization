const RULES: Array<[RegExp, string]> = [
  [/h100.*pcie/i, "H100 PCIe"],
  [/h100.*sxm|h100.*hbm/i, "H100 SXM"],
  [/h100/i, "H100 SXM"],
  [/a100.*80\s*gb/i, "A100 80GB"],
  [/a100.*40\s*gb/i, "A100 40GB"],
  [/a100/i, "A100 80GB"],
  [/h200/i, "H200"],
  [/b200/i, "B200"],
  [/l40s/i, "L40S"],
  [/l40/i, "L40"],
  [/rtx\s*4090|geforce.*4090/i, "RTX 4090"],
  [/rtx\s*6000\s*ada|6000\s*ada/i, "RTX 6000 Ada"],
  [/rtx\s*a6000/i, "RTX A6000"],
];

export function canonicalizeGpuName(input: string): string {
  const trimmed = input.trim();
  for (const [re, canon] of RULES) {
    if (re.test(trimmed)) return canon;
  }
  return trimmed;
}
