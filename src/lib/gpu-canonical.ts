const RULES: Array<[RegExp, string]> = [
  [/h100.*nvl/i, "H100 NVL"],
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

/**
 * Refine a canonical GPU model using additional signals (VRAM in GB per
 * GPU, free-form listing name). Catches cases where the bare model
 * string is ambiguous:
 *   - "A100" with 40 GB VRAM should be "A100 40GB", not "A100 80GB"
 *   - An "H100" listing whose name mentions PCIe should be "H100 PCIe"
 */
export function refineGpuModel(
  canonical: string,
  opts: { vramGb?: number; listingName?: string } = {},
): string {
  const { vramGb, listingName } = opts;

  // A100 40GB vs 80GB: canonicalizer defaults ambiguous "A100" to 80GB,
  // but many providers list 40GB SKUs under a bare "A100" name.
  if (canonical === "A100 80GB" && vramGb !== undefined && vramGb > 0 && vramGb < 60) {
    return "A100 40GB";
  }

  // H100 SXM vs PCIe vs NVL: short name "H100" is often used for
  // anything with an H100 chip; use listing name hints.
  if (listingName && canonical === "H100 SXM") {
    if (/\bNVL\b/i.test(listingName)) return "H100 NVL";
    if (/\bPCIe?\b/i.test(listingName)) return "H100 PCIe";
  }

  return canonical;
}
