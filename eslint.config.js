import eslintPluginAstro from "eslint-plugin-astro";
import tsParser from "@typescript-eslint/parser";
import tseslint from "typescript-eslint";

export default [
  ...eslintPluginAstro.configs.recommended,
  {
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
    },
  },
  // Ymir "capture and tighten": surface TS-strictness issues without breaking the
  // CI gate. These are warn-level so `eslint .` still exits 0; promote to "error"
  // once the codebase is clean.
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.astro"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  { rules: { "no-console": "error" } },
  { ignores: ["dist/**", ".astro/**", "public/pagefind/**"] },
];
