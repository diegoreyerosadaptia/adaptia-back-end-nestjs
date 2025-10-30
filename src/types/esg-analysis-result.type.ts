export interface EsgAnalysisResult {
    id: string;
    filename: string;
    pdfBuffer: Buffer | null;
    analysisJson: any;
  }
  