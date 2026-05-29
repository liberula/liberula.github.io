"use client";

import { useEffect } from "react";

export default function SpinfallPlayPage() {
  useEffect(() => {
    window.location.replace("/playables/spinfall/index.html");
  }, []);

  return null;
}