import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";


export default defineConfig([
  { files: [ "**/*.{js,mjs,cjs,ts}" ], plugins: { js }, extends: [ "js/recommended" ] },
  { files: [ "**/*.{js,mjs,cjs,ts}" ], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
  {
    rules: {
      semi: [ "warn", "always" ],
      "no-unused-vars": [ "error", {
        varsIgnorePattern: "^_$",
        argsIgnorePattern: "^_$",
        destructuredArrayIgnorePattern: "^_$",
        caughtErrorsIgnorePattern: "^_$"
      } ],
      "array-bracket-newline": [ "warn", "consistent" ],
      "array-element-newline": [ "warn", "consistent" ],
      "object-curly-spacing": [ "warn", "always" ],
      "array-bracket-spacing": [ "warn", "always" ],
    }
  }
]);
