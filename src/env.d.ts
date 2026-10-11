interface ImportMetaEnv {
  /** Web3Forms access key for the contact form (optional; falls back to mailto). */
  readonly PUBLIC_WEB3FORMS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
