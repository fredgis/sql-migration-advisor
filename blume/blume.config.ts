import { defineConfig } from "blume";

export default defineConfig({
  title: "SQL Migration Advisor",
  description:
    "A GitHub Copilot skill that turns any agent into a SQL Server to Azure migration advisor, grounded in a verified, weekly-refreshed knowledge base.",

  content: {
    root: "docs",
  },

  theme: {
    accent: "teal",
    radius: "md",
    mode: "system",
  },

  // GitHub Pages project site: https://fredgis.github.io/sql-migration-advisor
  deployment: {
    output: "static",
    site: "https://fredgis.github.io",
    base: "/sql-migration-advisor",
  },
});
