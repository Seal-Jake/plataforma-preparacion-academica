import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ThemePreference, UserInfo } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private http: HttpClient) {}

  get() {
    return this.http.get<UserInfo>('/api/profile');
  }

  update(data: { name?: string; themePreference?: ThemePreference; notificationsEnabled?: boolean }) {
    return this.http.put<UserInfo>('/api/profile', data);
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.put<void>('/api/profile/password', { currentPassword, newPassword });
  }

  uploadAvatar(file: File) {
    const form = new FormData();
    form.append('avatar', file);
    return this.http.post<UserInfo>('/api/profile/avatar', form);
  }
}
