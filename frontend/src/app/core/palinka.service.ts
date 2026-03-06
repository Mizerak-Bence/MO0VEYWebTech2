import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import type { CreatePalinkaRequest, Palinka } from './models';

@Injectable({ providedIn: 'root' })
export class PalinkaService {
  constructor(private readonly http: HttpClient) {}

  list() {
    return this.http.get<Palinka[]>(`${environment.apiBaseUrl}/palinkas`);
  }

  create(payload: CreatePalinkaRequest) {
    return this.http.post<{ id: string }>(`${environment.apiBaseUrl}/palinkas`, payload);
  }
}
