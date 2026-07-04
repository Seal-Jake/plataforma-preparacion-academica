import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ExportService {
  constructor(private http: HttpClient) {}

  private async download(url: string, filename: string) {
    const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(objectUrl);
  }

  exportUnitCsv(unitId: string) {
    return this.download(`/api/export/units/${unitId}/csv`, `notas-unidad-${unitId}.csv`);
  }

  exportCourseCsv(courseId: string) {
    return this.download(`/api/export/courses/${courseId}/csv`, `notas-curso-${courseId}.csv`);
  }

  exportTopicPdf(topicId: string, topicName: string) {
    return this.download(`/api/export/topics/${topicId}/pdf`, `${topicName}.pdf`);
  }
}
