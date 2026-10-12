interface ImportMetaEnv {
  /** Web3Forms access key for the contact form (optional; falls back to mailto). */
  readonly PUBLIC_WEB3FORMS_KEY?: string;
  /** Cloudflare Web Analytics site token (optional; without it no analytics script is loaded). */
  readonly PUBLIC_CF_ANALYTICS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
