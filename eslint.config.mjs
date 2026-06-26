import nextPlugin from "@eslint/js";

export default [
  nextPlugin.configs.recommended,
  {
    rules: {
      "no-unused-vars": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "postcss.config.js"],
  },
];
