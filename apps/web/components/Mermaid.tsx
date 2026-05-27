"use client";

import React, { useEffect, useId, useState } from "react";
import { mermaidThemeVariables } from "../lib/app-constants";
import { logError } from "../lib/debug";

interface MermaidProps {
  chart: string;
  hideOnError?: boolean;
}

export function Mermaid({ chart, hideOnError = false }: MermaidProps) {
  const renderId = useId();
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    
    const renderChart = async () => {
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;
        
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "loose",
          themeVariables: mermaidThemeVariables
        });

        const id = `mermaid-${renderId.replace(/:/g, "")}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        
        if (isMounted) {
          setSvg(renderedSvg);
          setError(false);
        }
      } catch (err) {
        logError("Mermaid rendering failed", err);
        if (isMounted) {
          setError(true);
        }
      }
    };

    renderChart();
    
    return () => {
      isMounted = false;
    };
  }, [chart, renderId]);

  if (error) {
    if (hideOnError) return null;

    return (
      <div className="text-xs text-text-muted italic bg-neutral-soft/50 p-3 rounded">
        Could not render diagram. Raw text:
        <pre className="mt-1 font-mono text-[10px] whitespace-pre-wrap">{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="h-20 flex items-center justify-center text-xs text-text-muted animate-pulse">
        Rendering diagram...
      </div>
    );
  }

  return (
    <div 
      className="w-full overflow-x-auto flex justify-center py-2"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
}
