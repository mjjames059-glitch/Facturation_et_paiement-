"use client";

import { useRouter } from "next/navigation";

export function BackLink() {
  const router = useRouter();

  return (
    <button
      className="legal-back-link"
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
    >
      ← Retour à la page précédente
    </button>
  );
}
