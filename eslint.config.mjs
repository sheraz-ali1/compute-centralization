import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // The Fluid Functionalism components are vendored from a third-party
  // shadcn registry. They have known minor React-rules violations
  // (ref-in-render, setState-in-effect) that we don't own and don't want
  // to patch on every upstream sync.
  {
    files: ["src/components/ui/tooltip.tsx", "src/components/ui/tabs-subtle.tsx"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
