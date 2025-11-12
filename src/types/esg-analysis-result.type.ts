export interface EsgAnalysisResult {
  id: string;
  filename?: string;
  pdfBuffer?: Buffer | null;
  analysisJson: Record<string, any> | null;
  status?: 'COMPLETE' | 'INCOMPLETE' | 'FAILED';
  failedPrompts?: string[]; // 👈 importante para los prompts fallidos
}
