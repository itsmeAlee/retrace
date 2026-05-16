import type { CaptureType } from "@retrace/types";
import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const defaultCaptureType: CaptureType = "note";

function Popup() {
  return (
    <main>
      <h1>Retrace</h1>
      <p>Ready to capture a {defaultCaptureType}.</p>
    </main>
  );
}

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
}
