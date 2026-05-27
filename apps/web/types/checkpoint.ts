export interface SourceReference {
  title: string;
  source_type: string;
  url: string | null;
  file_id: string | null;
  domain: string | null;
}

export interface DiagramOutput {
  diagram_type: string;
  mermaid_type: string;
  mermaid_code: string;
  explanation: string;
}

export interface CheckpointAIData {
  aiTitle: string;
  aiContext: string;
  aiKeyPoints: string[];
  aiSourcesUsed: SourceReference[];
  aiDiagrams: DiagramOutput[];
  aiStatus: "pending" | "processing" | "complete" | "failed";
  aiProcessedAt: string | null;
  aiCaptureCount?: number;
  aiError?: string;
}
