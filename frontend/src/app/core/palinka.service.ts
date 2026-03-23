import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import type { CreatePalinkaRequest, Palinka, UpdatePalinkaRequest } from './models';

@Injectable({ providedIn: 'root' })
export class PalinkaService {
  constructor(private readonly http: HttpClient) {}

  list() {
    return this.http.get<Palinka[]>(`${environment.apiBaseUrl}/palinkas`);
  }

  getById(id: string) {
    return this.http.get<Palinka>(`${environment.apiBaseUrl}/palinkas/${id}`);
  }

  create(payload: CreatePalinkaRequest) {
    return this.http.post<{ id: string }>(`${environment.apiBaseUrl}/palinkas`, payload);
  }

  update(id: string, payload: UpdatePalinkaRequest) {
    return this.http.put<Palinka>(`${environment.apiBaseUrl}/palinkas/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<void>(`${environment.apiBaseUrl}/palinkas/${id}`);
  }
}
