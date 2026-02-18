/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string
    readonly VITE_APPWRITE_ENDPOINT: string
    readonly VITE_APPWRITE_PROJECT_ID: string
    readonly VITE_APPWRITE_DATABASE_ID: string
    readonly VITE_RAZORPAY_KEY_ID: string
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
