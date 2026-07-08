import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';

interface OcrTestResponse {
  durationMs: number;
  fileUrl: string;
  modelUsed: string | null;
  ocrData: unknown;
  toolInputRawJson: string | null;
  parseError: string | null;
  rawAnthropicResponse: string;
}

interface BatchResult {
  fileName: string;
  response: OcrTestResponse | null;
  errorMessage: string | null;
}

@Component({
  selector: 'app-ocr-test-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ocr-test-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcrTestPageComponent {
  private readonly http = inject(HttpClient);

  readonly loading = signal(false);
  readonly results = signal<BatchResult[]>([]);
  readonly progress = signal<{ done: number; total: number } | null>(null);

  readonly hasResults = computed(() => this.results().length > 0);

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const files = Array.from(input.files);
    await this.runBatch(files);
    input.value = ''; // permitir volver a elegir los mismos archivos
  }

  private async runBatch(files: File[]): Promise<void> {
    this.loading.set(true);
    this.results.set([]);
    this.progress.set({ done: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await this.runOcrSingle(file);
      this.results.update(arr => [...arr, result]);
      this.progress.set({ done: i + 1, total: files.length });
    }

    this.loading.set(false);
  }

  private async runOcrSingle(file: File): Promise<BatchResult> {
    const form = new FormData();
    form.append('File', file, file.name);
    form.append('Name', file.name.replace(/\.pdf$/i, ''));
    form.append('Type', 'PDF');

    try {
      const response = await firstValueFrom(
        this.http.post<OcrTestResponse>(`${environment.apiUrl}/files/test-gas-ocr`, form)
      );
      return { fileName: file.name, response, errorMessage: null };
    } catch (err: unknown) {
      const e = err as { error?: { message?: string }; message?: string };
      return {
        fileName: file.name,
        response: null,
        errorMessage: e?.error?.message ?? e?.message ?? 'Error desconocido',
      };
    }
  }

  prettyJson(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  copyAllResults(): void {
    const blocks = this.results().map((r, idx) => {
      const header = `=== Factura ${idx + 1} — ${r.fileName} ===`;
      if (r.errorMessage) {
        return `${header}\nERROR HTTP: ${r.errorMessage}`;
      }
      const res = r.response!;
      const body = res.parseError
        ? `PARSE ERROR: ${res.parseError}\n--- tool_use input ---\n${res.toolInputRawJson}`
        : this.prettyJson(res.ocrData);
      const model = res.modelUsed ? ` ${res.modelUsed}` : '';
      const stats = `[${res.durationMs} ms${model}]`;
      return `${header} ${stats}\n${body}`;
    });
    navigator.clipboard.writeText(blocks.join('\n\n'));
  }

  copySingleJson(index: number): void {
    const r = this.results()[index];
    if (!r?.response) return;
    navigator.clipboard.writeText(this.prettyJson(r.response.ocrData));
  }
}
