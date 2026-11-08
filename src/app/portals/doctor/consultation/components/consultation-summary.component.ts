import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ConsultationPageVm } from '../doctor-consultation.types';
import { Diagnosis, LabRequest, PrescriptionItem, VitalSigns } from '../../../../core/models';

@Component({
  selector: 'app-consultation-summary',
  standalone: true,
  imports: [DatePipe, NgIf, NgFor],
  templateUrl: './consultation-summary.component.html',
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
      min-width: 100%;
      --cs-bg: #f3f7fb;
      --cs-surface: #ffffff;
      --cs-surface-soft: #f8fafc;
      --cs-border: #dbe4ee;
      --cs-border-soft: #e7edf4;
      --cs-text: #0f172a;
      --cs-text-strong: #172554;
      --cs-text-muted: #64748b;
      --cs-label: #8a94a6;
      --cs-shadow: 0 24px 48px rgba(15, 23, 42, 0.07), 0 3px 10px rgba(15, 23, 42, 0.05);
      --cs-radius-lg: 20px;
      --cs-radius-md: 16px;
      --cs-radius-pill: 999px;
      --cs-pad-panel: 16px;
    }

    .cs {
      position: relative;
      width: 100%;
      max-width: 100%;
      min-width: 100%;
      display: block;
    }

    .cs-record {
      display: grid;
      gap: 18px;
      width: 100%;
      max-width: none;
      margin: 0;
      padding: 20px;
      background:
        radial-gradient(circle at top left, rgba(191, 219, 254, 0.2), transparent 28%),
        linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(243, 247, 251, 0.98));
      border: 1px solid var(--cs-border);
      border-radius: 24px;
      box-shadow: var(--cs-shadow);
      overflow: hidden;
    }

    .cs-record__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding-bottom: 14px;
      border-bottom: 1px solid #e6edf5;
    }

    .cs-record__heading {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .cs-record__eyebrow {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 4px 10px;
      border-radius: 999px;
      background: #e0f2fe;
      color: #075985;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .cs-record__title {
      margin: 0;
      font-size: 1.02rem;
      line-height: 1.2;
      font-weight: 750;
      color: #0f172a;
      letter-spacing: -0.01em;
    }

    .cs-record__sub {
      margin: 0;
      color: #64748b;
      font-size: var(--text-sm);
      line-height: 1.45;
      max-width: 760px;
    }

    .cs-record__meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .cs-record__chip {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 0 12px;
      border-radius: var(--cs-radius-pill);
      border: 1px solid var(--cs-border);
      background: rgba(255, 255, 255, 0.92);
      color: var(--cs-text-strong);
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
    }

    .cs-record__chip--soft {
      background: #eef5ff;
      color: #1e3a8a;
    }

    .cs-record__body {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.9fr);
      gap: 16px;
      align-items: start;
    }

    .cs-panel,
    .cs-subpanel {
      min-width: 0;
    }

    .cs-panel--soap,
    .cs-subpanel {
      background: var(--cs-surface);
      border: 1px solid rgba(219, 228, 238, 0.7);
      border-radius: var(--cs-radius-lg);
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
    }

    .cs-panel--soap {
      padding: var(--cs-pad-panel);
    }

    .cs-panel--rail {
      display: grid;
      gap: 12px;
      padding: 12px;
      background: var(--cs-surface-soft);
      border: 1px solid var(--cs-border-soft);
      border-radius: calc(var(--cs-radius-lg) + 2px);
    }

    .cs-panel__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    .cs-panel__head--tight {
      margin-bottom: 10px;
    }

    .cs-panel__title {
      margin: 0;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--cs-text);
    }

    .cs-panel__sub {
      margin: 3px 0 0;
      font-size: 0.72rem;
      color: var(--cs-text-muted);
      line-height: 1.35;
    }

    .cs-panel__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 8px;
      border-radius: var(--cs-radius-pill);
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 0.68rem;
      font-weight: 700;
    }

    .cs-soap {
      display: grid;
      gap: 8px;
    }

    .cs-soap__block {
      position: relative;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      padding: 12px 0 12px 14px;
    }

    .cs-soap__block + .cs-soap__block {
      border-top: 1px solid #edf2f7;
    }

    .cs-soap__block::before {
      content: '';
      position: absolute;
      left: 0;
      top: 11px;
      bottom: 11px;
      width: 4px;
      border-radius: var(--cs-radius-pill);
      background: #cbd5e1;
    }

    .cs-soap__block--cc::before { background: linear-gradient(180deg, #f59e0b, #d97706); }
    .cs-soap__block--s::before { background: linear-gradient(180deg, #60a5fa, #2563eb); }
    .cs-soap__block--o::before { background: linear-gradient(180deg, #34d399, #059669); }
    .cs-soap__block--a::before { background: linear-gradient(180deg, #a78bfa, #7c3aed); }
    .cs-soap__block--p::before { background: linear-gradient(180deg, #f472b6, #db2777); }

    .cs-soap__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 999px;
      font-size: 0.66rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .cs-soap__badge--cc { background: #fef3c7; color: #92400e; }
    .cs-soap__badge--s { background: #dbeafe; color: #1d4ed8; }
    .cs-soap__badge--o { background: #d1fae5; color: #047857; }
    .cs-soap__badge--a { background: #ede9fe; color: #6d28d9; }
    .cs-soap__badge--p { background: #fce7f3; color: #be185d; }

    .cs-soap__content {
      min-width: 0;
      padding: 12px 14px;
      border-radius: var(--cs-radius-md);
      background: #ffffff;
      border: 1px solid var(--cs-border-soft);
    }

    .cs-soap__block--cc .cs-soap__content { background: linear-gradient(180deg, #fffdf7, #ffffff); }
    .cs-soap__block--s .cs-soap__content { background: linear-gradient(180deg, #f3f8ff, #ffffff); }
    .cs-soap__block--o .cs-soap__content { background: linear-gradient(180deg, #f1fbf7, #ffffff); }
    .cs-soap__block--a .cs-soap__content { background: linear-gradient(180deg, #f7f5ff, #ffffff); }
    .cs-soap__block--p .cs-soap__content { background: linear-gradient(180deg, #fff6fb, #ffffff); }

    .cs-soap__label {
      margin: 0 0 2px;
      font-size: 0.66rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--cs-label);
    }

    .cs-text {
      margin: 0;
      white-space: pre-wrap;
      line-height: 1.6;
      color: #203042;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .cs-vitals-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .cs-vital {
      display: grid;
      gap: 7px;
      padding: 12px;
      background: linear-gradient(180deg, #ffffff, #f9fbfd);
      border: 1px solid var(--cs-border-soft);
      border-radius: var(--cs-radius-md);
      min-height: 86px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    .cs-vital--span {
      grid-column: span 2;
    }

    .cs-vital__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .cs-vital__indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #93c5fd;
      box-shadow: 0 0 0 4px rgba(147, 197, 253, 0.18);
      flex-shrink: 0;
    }

    .cs-vital--heart .cs-vital__indicator { background: #fb7185; box-shadow: 0 0 0 4px rgba(251, 113, 133, 0.16); }
    .cs-vital--resp .cs-vital__indicator { background: #22c55e; box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.16); }
    .cs-vital--temp .cs-vital__indicator { background: #f59e0b; box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.16); }
    .cs-vital--oxygen .cs-vital__indicator { background: #14b8a6; box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.16); }
    .cs-vital--weight .cs-vital__indicator,
    .cs-vital--height .cs-vital__indicator { background: #94a3b8; box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.14); }
    .cs-vital--bmi .cs-vital__indicator { background: #8b5cf6; box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.14); }
    .cs-vital--pain .cs-vital__indicator { background: #ef4444; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.16); }

    .cs-vital--alert {
      border-color: rgba(245, 158, 11, 0.35);
      background: linear-gradient(180deg, #fffdf8, #ffffff);
    }

    .cs-vital--alert .cs-vital__indicator {
      background: #f59e0b;
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18);
    }

    .cs-vital--pain {
      border-color: rgba(239, 68, 68, 0.22);
      background: linear-gradient(180deg, #fff5f6, #ffffff);
    }

    .cs-vital__label {
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--cs-label);
    }

    .cs-vital__value {
      color: var(--cs-text);
      font-size: 1rem;
      line-height: 1.12;
      font-weight: 800;
      letter-spacing: -0.01em;
    }

    .cs-vital__unit {
      font-size: 0.72rem;
      color: #64748b;
      font-weight: 700;
      margin-left: 1px;
    }

    .cs-vital__deg {
      font-size: 0.75rem;
      vertical-align: top;
    }

    .cs-dx {
      display: grid;
      gap: 8px;
    }

    .cs-dx__row {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 8px 0;
      border-top: 1px solid #edf2f7;
    }

    .cs-dx__row:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .cs-dx__code {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.74rem;
      color: #64748b;
      white-space: nowrap;
    }

    .cs-dx__desc {
      min-width: 0;
      color: #334155;
      font-size: 0.92rem;
      line-height: 1.45;
    }

    .cs-dx__type {
      display: flex;
      justify-content: flex-end;
    }

    .cs-follow-up {
      display: grid;
      gap: 6px;
      padding: 12px 14px;
      border-radius: 16px;
      background: linear-gradient(180deg, #eef2ff, #e0e7ff);
      border: 1px solid #c7d2fe;
    }

    .cs-follow-up__label {
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #4338ca;
    }

    .cs-follow-up__date {
      font-size: 1rem;
      line-height: 1.2;
      font-weight: 800;
      color: #312e81;
    }

    .cs-bottom {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .cs-subpanel {
      padding: 14px;
    }

    .cs-subpanel--table {
      min-height: 100%;
    }

    .cs-tbl-wrap {
      overflow-x: auto;
      margin: 0;
    }

    .cs-tbl {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    .cs-tbl thead {
      border-bottom: 1px solid var(--cs-border);
    }

    .cs-tbl th {
      text-align: left;
      padding: 7px 8px;
      font-size: 0.62rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--cs-label);
      font-weight: 800;
      background: #f8fafc;
      white-space: nowrap;
    }

    .cs-tbl td {
      padding: 8px 8px;
      border-bottom: 1px solid #edf2f7;
      color: #203042;
      vertical-align: middle;
    }

    .cs-tbl tbody tr:last-child td {
      border-bottom: none;
    }

    .cs-tbl tbody tr:hover {
      background: #f8fafc;
    }

    .cs-tbl__num {
      text-align: center;
      white-space: nowrap;
    }

    .cs-tbl__muted {
      color: #64748b;
    }

    .cs-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: var(--cs-radius-pill);
      font-size: 0.64rem;
      font-weight: 700;
      line-height: 1.4;
      background: #f1f5f9;
      color: #475569;
      white-space: nowrap;
    }

    .cs-badge--primary { background: #dbeafe; color: #1d4ed8; }
    .cs-badge--warn { background: #fef3c7; color: #92400e; }
    .cs-badge--danger { background: #fee2e2; color: #dc2626; }

    .cs-empty-state {
      padding: 12px 0 2px;
      color: #94a3b8;
      font-style: normal;
      font-size: 0.8rem;
    }

    .cs-empty-state--compact {
      padding-top: 8px;
    }

    @media (max-width: 1439px) {
      .cs-record {
        padding: 18px;
        gap: 16px;
        border-radius: 22px;
        width: 100%;
        max-width: none;
      }

      .cs-record__body {
        grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.82fr);
        gap: 14px;
      }

      .cs-panel--soap,
      .cs-panel--rail,
      .cs-subpanel {
        border-radius: 18px;
      }

      .cs-panel--soap,
      .cs-panel--rail {
        padding: 14px;
      }

      .cs-subpanel {
        padding: 12px;
      }

      .cs-bottom {
        gap: 10px;
      }

      .cs-vital {
        min-height: 66px;
        padding: 9px 10px;
      }

      .cs-text {
        font-size: 0.92rem;
        line-height: 1.5;
      }
    }

    @media (max-width: 1199px) {
      .cs-record__body,
      .cs-bottom {
        grid-template-columns: 1fr;
      }

      .cs-vitals-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .cs-vital--span {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 1024px) {
      .cs-vitals-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 768px) {
      .cs-record {
        padding: 14px;
        gap: 14px;
        border-radius: 18px;
        width: 100%;
        max-width: none;
      }

      .cs-record__header {
        padding-bottom: 12px;
      }

      .cs-record__meta {
        justify-content: flex-start;
      }

      .cs-vitals-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .cs-dx__row {
        grid-template-columns: 52px minmax(0, 1fr);
      }

      .cs-dx__type {
        grid-column: 1 / -1;
        justify-content: flex-start;
      }
    }

    @media (max-width: 480px) {
      .cs-record {
        padding: 12px;
      }

      .cs-panel--soap,
      .cs-panel--rail,
      .cs-subpanel {
        padding: 12px;
      }

      .cs-soap__block {
        gap: 8px;
        padding: 8px 0;
      }

      .cs-soap__badge {
        width: 24px;
        height: 24px;
      }

      .cs-text {
        font-size: 0.88rem;
      }

      .cs-vitals-grid {
        grid-template-columns: 1fr;
      }

      .cs-vital--span {
        grid-column: auto;
      }
    }
  `]
})
export class ConsultationSummaryComponent {
  @Input({ required: true }) vm!: ConsultationPageVm;

  rxExpanded = true;

  get vitals(): VitalSigns | undefined { return this.vm.consultation?.vitalSigns; }

  get hasVitals(): boolean {
    const v = this.vitals;
    if (!v) return false;
    return [
      v.bloodPressureSystolic,
      v.bloodPressureDiastolic,
      v.heartRate,
      v.respiratoryRate,
      v.temperatureCelsius,
      v.oxygenSaturation,
      v.weightKg,
      v.heightCm,
      v.bmi,
      v.painScore
    ].some(x => x !== null && x !== undefined);
  }

  get hasSoap(): boolean {
    const c = this.vm.consultation;
    if (!c) return false;
    return !!(c.chiefComplaint || c.subjective || c.objective || c.assessment || c.plan);
  }

  get diagnoses(): Diagnosis[] { return this.vm.consultation?.diagnoses ?? []; }
  get prescriptionItems(): PrescriptionItem[] { return this.vm.existingPrescription?.items ?? []; }
  get labRequests(): LabRequest[] { return this.vm.labRequests ?? []; }
  get followUpDate(): string | null | undefined {
    return this.vm.consultation?.followUpDate || this.vm.followUpDraft?.followUpDate;
  }

  isBloodPressureOutOfRange(): boolean {
    const v = this.vitals;
    return !!v && (
      (v.bloodPressureSystolic !== null && v.bloodPressureSystolic !== undefined && v.bloodPressureSystolic >= 140) ||
      (v.bloodPressureDiastolic !== null && v.bloodPressureDiastolic !== undefined && v.bloodPressureDiastolic >= 90)
    );
  }

  isHeartRateOutOfRange(): boolean {
    const value = this.vitals?.heartRate;
    return value !== null && value !== undefined && (value < 60 || value > 100);
  }

  isRespiratoryRateOutOfRange(): boolean {
    const value = this.vitals?.respiratoryRate;
    return value !== null && value !== undefined && (value < 12 || value > 20);
  }

  isTemperatureOutOfRange(): boolean {
    const value = this.vitals?.temperatureCelsius;
    return value !== null && value !== undefined && value >= 37.5;
  }

  isOxygenOutOfRange(): boolean {
    const value = this.vitals?.oxygenSaturation;
    return value !== null && value !== undefined && value < 95;
  }

  isBmiOutOfRange(): boolean {
    const value = this.vitals?.bmi;
    return value !== null && value !== undefined && (value < 18.5 || value >= 25);
  }
}
