export const LEGAL_DOCUMENT_VERSION = "2026-10-27";

export function getLegalConsentMetadata() {
  return {
    legal_terms_version: LEGAL_DOCUMENT_VERSION,
    legal_privacy_version: LEGAL_DOCUMENT_VERSION,
    legal_consent_accepted_at: new Date().toISOString(),
  };
}
