"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "sidebar-collapsed";
const listeners = new Set<() => void>();

// Copia in memoria: serve se l'archivio del browser non è disponibile
let memory = false;

function read(): boolean {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === null ? memory : saved === "1";
  } catch {
    return memory;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// Menu laterale ridotto alle sole icone: la scelta resta salvata nel browser e vale per tutte le pagine
export function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);

  const toggle = useCallback(() => {
    memory = !read();
    try {
      localStorage.setItem(KEY, memory ? "1" : "0");
    } catch {
      /* senza archivio del browser la scelta vale solo finché la pagina resta aperta */
    }
    listeners.forEach(l => l());
  }, []);

  return [collapsed, toggle];
}
