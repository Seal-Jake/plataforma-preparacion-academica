import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NotificationsResponse } from '../models/models';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  constructor(private http: HttpClient) {}

  get() {
    return this.http.get<NotificationsResponse>('/api/notifications');
  }
}
