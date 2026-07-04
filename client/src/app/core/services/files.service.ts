import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FilesService {
  constructor(private http: HttpClient) {}

  async download(fileId: string, filename: string) {
    const blob = await firstValueFrom(this.http.get(`/api/files/${fileId}/download`, { responseType: 'blob' }));
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => window.URL.revokeObjectURL(url), 10000);
  }

  delete(fileId: string) {
    return this.http.delete<void>(`/api/files/${fileId}`);
  }
}
