// Pretty display names for providers. Falls back to titlecasing the slug
// if not in the map.
const LABELS: Record<string, string> = {
  runpod: "RunPod",
  vast: "Vast.ai",
  vultr: "Vultr",
  "lambda-labs": "Lambda Labs",
  coreweave: "CoreWeave",
  paperspace: "Paperspace",
  hyperstack: "Hyperstack",
  "cudo-compute": "Cudo Compute",
  tensordock: "TensorDock",
  fluidstack: "Fluidstack",
  "together-ai": "Together AI",
  nebius: "Nebius",
  "novita-ai": "Novita AI",
  crusoe: "Crusoe",
  "google-cloud": "Google Cloud",
  "microsoft-azure": "Azure",
  aws: "AWS",
  "oracle-cloud": "Oracle Cloud",
  digitalocean: "DigitalOcean",
  ovh: "OVHcloud",
  scaleway: "Scaleway",
  gcore: "Gcore",
  sesterce: "Sesterce",
  "massed-compute": "Massed Compute",
  verda: "Verda",
  lyceum: "Lyceum",
  civo: "Civo",
  koyeb: "Koyeb",
  "theta-edgecloud": "Theta Edge",
  replicate: "Replicate",
  "thunder-compute": "Thunder",
  oblivus: "Oblivus",
  "packet-ai": "Packet AI",
  "fal-ai": "fal.ai",
  cerebrium: "Cerebrium",
  beam: "Beam",
  contabo: "Contabo",
  "database-mart": "DatabaseMart",
  enverge: "Enverge",
  "greenai-cloud": "GreenAI Cloud",
  "acecloud": "Ace Cloud",
  "cirrascale": "Cirrascale",
  "vast-ai": "Vast.ai",
};

export function providerLabel(provider: string): string {
  if (LABELS[provider]) return LABELS[provider];
  return provider
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function tierLabel(tier: string): string {
  const map: Record<string, string> = {
    secure: "Secure",
    community: "Community",
    verified: "Verified",
    unverified: "Unverified",
    standard: "On-demand",
  };
  return map[tier] ?? tier;
}
