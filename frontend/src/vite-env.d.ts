/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_AGENT1_URL: string
  readonly VITE_API_AGENT2_URL?: string
  readonly VITE_API_AGENT3_URL?: string
  readonly VITE_API_AGENT4_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
