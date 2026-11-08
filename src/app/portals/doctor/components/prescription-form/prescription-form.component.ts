import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { Allergy, PrescriptionItem } from '../../../../core/models';
import { ApiService } from '../../../../core/services/api.service';
import {
  DrugAllergyConflict,
  DrugInteractionResult,
  DrugInteractionService,
  DrugInteractionWarning,
  UnknownAllergyCheckResponse,
  UnknownInteractionCheckResponse,
  normalizeAllergyResponse,
  normalizeInteractionResponse
} from '../../../../core/services/drug-interaction.service';
import {
  MEDICATION_FREQUENCY_MASTERS,
  MEDICATION_ROUTE_MASTERS,
  MEDICATION_UOM_MASTERS
} from '../prescription-builder/prescription-masters';
import { PRESCRIPTION_DRUG_LIST } from '../prescription-builder/prescription-drug-list';

type PrescriptionActionMode = 'edit' | 'request';

interface PendingMedicineAction {
  mode: 'add' | 'update';
  reasonRequired: boolean;
}

@Component({
  selector: 'app-prescription-form',
  standalone: true,
  imports: [NgClass, NgFor, NgIf, ReactiveFormsModule, FormsModule],
  templateUrl: './prescription-form.component.html',
  styles: [
    `
      :host{display:block;scroll-margin-top:128px}
      .pf{display:grid;gap:var(--space-4)}
      .pf-hidden-fields{display:none}
      .pf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--space-3)}
      .pf-f{display:grid;gap:4px;position:relative}
      .pf-f label{font-size:12px;font-weight:500;color:#475569;text-transform:uppercase}
      .pf-f input,.pf-f select{padding:var(--space-2) var(--space-3);font-size:14px;border:1px solid #e2e8f0;border-radius:var(--radius-md);outline:none;background:#fff;color:var(--clinic-text-primary);width:100%;min-height:44px}
      .pf-f input:focus,.pf-f select:focus{border-color:var(--ion-color-primary);box-shadow:0 0 0 2px rgba(93,62,142,.12)}
      .pf-f select:disabled,.pf-f input[readonly]{background:#f3f4f6;color:#6b7280;cursor:not-allowed}
      .pf-full{grid-column:1/-1}
      .pf-qty-field{max-width:200px}
      .pf-suggest{position:absolute;top:100%;left:0;right:0;z-index:50;background:#fff;border:1px solid #e2e8f0;border-radius:var(--radius-md);box-shadow:var(--shadow-lg);max-height:200px;overflow-y:auto}
      .pf-suggest button{display:grid;gap:2px;width:100%;padding:var(--space-2) var(--space-3);text-align:left;font-size:var(--text-sm);border:none;background:transparent;cursor:pointer}
      .pf-suggest button:hover{background:var(--color-primary-50)}
      .pf-suggest button span{font-size:var(--text-xs);color:#64748b}
      .pf-preview{background:#f8fafc;border-radius:var(--radius-md);padding:14px 16px;display:grid;gap:4px}
      .pf-preview__label{font-size:11px;font-weight:600;color: var(--clinic-text-muted);text-transform:uppercase;letter-spacing:.05em;margin:0}
      .pf-preview__medicine{font-size:15px;font-weight:600;color:#1e293b;margin:0}
      .pf-preview__uom{font-weight:400;color:#64748b}
      .pf-preview__sig{font-size:13px;color:#475569;margin:0}
      .pf-preview__dispense{font-size:14px;color:#1e293b;margin:0}
      .pf-actions{display:flex;justify-content:flex-end;gap:var(--space-3);margin-top:var(--space-2)}
      .pf-btn{padding:10px 20px;font-size:14px;border-radius:8px;border:none;cursor:pointer;font-weight:500}
      .pf-btn-cancel{background:#e2e8f0;color:#475569}
      .pf-btn-cancel:hover:not(:disabled){background:#cbd5e1}
      .pf-btn-save{background:var(--ion-color-primary,#1e293b);color:#fff}
      .pf-btn-save:hover:not(:disabled){filter:brightness(0.92)}
      .pf-btn:disabled{opacity:0.6;cursor:not-allowed}
      .pf-added{display:grid;gap:var(--space-2);margin-top:var(--space-3)}
      .pf-item{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-3);padding:var(--space-3);background:#f8fafc;border-radius:var(--radius-md)}
      .pf-item-info{display:grid;gap:2px;min-width:0}
      .pf-item-info strong{font-size:var(--text-sm)}
      .pf-item-info span{font-size:var(--text-xs);color:#64748b}
      .pf-item-inst{color:#6b21a8}
      .pf-item-warning{display:inline-flex;align-items:center;gap:8px;padding-top:4px;color:#b45309;font-size:12px;font-weight:600}
      .pf-item-warning__link{border:none;background:transparent;color:#5d3e8e;padding:0;font-weight:700;cursor:pointer}
      .pf-item-acts{display:flex;gap:var(--space-1);flex-shrink:0}
      .pf-item-acts button{padding:var(--space-1) var(--space-2);font-size:var(--text-xs);border:1px solid #e2e8f0;border-radius:var(--radius-sm);background:#fff;cursor:pointer;color:#475569}
      .pf-item-acts button:hover{border-color:var(--ion-color-primary);color:var(--ion-color-primary)}
      .pf-remove{color:#dc2626!important}
      .pf-empty{text-align:center;color: var(--clinic-text-muted);font-size:var(--text-sm);padding:var(--space-4)}
      .pf-banner{border-radius:16px;padding:12px 14px;display:grid;gap:6px;border:1px solid transparent}
      .pf-banner--warn{background:#fffbeb;border-color:#fcd34d;color:#92400e}
      .pf-banner--danger{background:#fef2f2;border-color:#fca5a5;color:#991b1b}
      .pf-banner__copy{font-size:13px;line-height:1.4}
      .pf-banner__actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
      .pf-banner__reason{display:grid;gap:6px}
      .pf-banner__reason label{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
      .pf-banner__reason textarea{width:100%;border:1px solid #fecaca;border-radius:12px;padding:10px 12px;font:inherit;resize:vertical;min-height:76px}
      .pf-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:220}
      .pf-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;z-index:221}
      .pf-modal__card{width:min(520px,100%);background:#fff;border-radius:20px;padding:18px;box-shadow:0 20px 50px rgba(15,23,42,.24)}
      .pf-modal__head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .pf-modal__head h4{margin:0;font-size:18px}
      .pf-modal__close{width:36px;height:36px;border-radius:50%;border:1px solid #e2e8f0;background:#fff;font-size:20px}
      .pf-modal__severity{margin:12px 0 8px;font-weight:700;color:#b45309}
      .pf-modal__severity--red{color:#b91c1c}
      .pf-modal__body{margin:0;color:#475569;line-height:1.55}
      @media(max-width:767px){.pf-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pf-item{flex-direction:column}.pf-full{grid-column:1/-1}.pf-qty-field{max-width:none}}
      @media(max-width:374px){.pf-grid{grid-template-columns:1fr}}
    `
  ]
})
export class PrescriptionFormComponent implements OnChanges {
  @Input() items: PrescriptionItem[] = [];
  @Input() allergies: Allergy[] = [];
  @Input() auditText = 'Not yet edited this visit';
  @Input() locked = false;
  @Input() actionMode: PrescriptionActionMode = 'edit';
  @Output() itemsChange = new EventEmitter<PrescriptionItem[]>();
  @Output() requestAttendingPhysician = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly apiService = inject(ApiService);
  private readonly interactionService = inject(DrugInteractionService);

  readonly form = this.fb.group({
    medicineName: [''],
    strength: [''],
    dosage: [''],
    dose: ['1'],
    uom: ['TAB'],
    route: ['PO'],
    frequency: ['once a day'],
    duration: [''],
    quantity: [1],
    instructions: ['']
  });

  readonly routeOptions = MEDICATION_ROUTE_MASTERS.map((r) => ({ value: r.route_code, label: r.route_description }));
  readonly freqOptions = [...MEDICATION_FREQUENCY_MASTERS].sort((a, b) => a.priority_order - b.priority_order).map((f) => ({ value: f.dosage_desc, label: f.dosage_desc }));
  readonly uomOptions = MEDICATION_UOM_MASTERS.map((u) => ({ value: u.unit_of_measure, label: u.unit_of_measure }));
  readonly whenOptions = ['After dinner', 'Before meals', 'After meals', 'At bedtime', 'On an empty stomach', 'With food'];

  private readonly routeAdverbs: Record<string, string> = {
    PO: 'orally',
    TOP: 'topically',
    IV: 'intravenously',
    IM: 'intramuscularly',
    SUBCUT: 'subcutaneously',
    SL: 'sublingually',
    PR: 'rectally',
    VAG: 'vaginally',
    OPTH: 'in the eye(s)',
    NEB: 'via nebulizer'
  };

  medicines: PrescriptionItem[] = [];
  editIdx = -1;
  showDrugSuggestions = false;
  interactionWarnings: Record<string, DrugInteractionWarning> = {};
  interactionCheckUnavailable = false;
  interactionDetailsOpen = false;
  selectedInteraction: DrugInteractionWarning | null = null;
  activeAllergyConflict: DrugAllergyConflict | null = null;
  awaitingOverrideReason = false;
  overrideReason = '';
  private pendingMedicineAction: PendingMedicineAction | null = null;

  get isReadOnlyFields(): boolean {
    return this.locked || this.actionMode === 'request';
  }

  get filteredDrugs(): Array<{ medicineName: string; genericName?: string }> {
    const q = (this.form.get('medicineName')?.value || '').toLowerCase();
    return q ? PRESCRIPTION_DRUG_LIST.filter((d) => [d.medicineName, d.genericName].join(' ').toLowerCase().includes(q)).slice(0, 6) : [];
  }

  getMedicineDisplayName(): string {
    return String(this.form.get('medicineName')?.value ?? '').trim();
  }

  getSigPreview(): string {
    return this.buildSig(this.form.getRawValue());
  }

  hideDrugSuggestions() { setTimeout(() => this.showDrugSuggestions = false, 200); }
  filterDrugs() { this.showDrugSuggestions = true; }

  selectDrug(d: { medicineName: string; genericName?: string }) {
    this.form.patchValue({ medicineName: d.medicineName });
    this.showDrugSuggestions = false;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.medicines = (this.items || []).map((i) => ({ ...i }));
      this.refreshInteractionWarnings();
    }

    if (changes['locked'] || changes['actionMode']) {
      if (this.isReadOnlyFields) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    }
  }

  async attemptSaveMedicine(): Promise<void> {
    if (this.isReadOnlyFields) {
      return;
    }

    const current = this.form.getRawValue();
    const name = String(current.medicineName ?? '').trim();
    if (!name) {
      return;
    }

    const action: PendingMedicineAction = { mode: this.editIdx >= 0 ? 'update' : 'add', reasonRequired: false };
    this.pendingMedicineAction = action;
    this.overrideReason = '';
    this.awaitingOverrideReason = false;

    const allergyCacheKey = this.interactionService.buildAllergyCacheKey(name, this.allergies);
    const cachedAllergyConflict = this.interactionService.getCachedAllergyConflict(allergyCacheKey);
    if (cachedAllergyConflict) {
      this.interactionCheckUnavailable = Boolean(cachedAllergyConflict.unavailable);
      if (cachedAllergyConflict.conflict) {
        this.activeAllergyConflict = cachedAllergyConflict;
        return;
      }
    }

    const localConflict = this.interactionService.evaluateAllergyConflict(name, this.allergies);
    if (localConflict?.conflict) {
      this.interactionService.setAllergyConflict(allergyCacheKey, localConflict);
      this.activeAllergyConflict = localConflict;
      return;
    }

    const apiAllergyConflict = await firstValueFrom(
      this.apiService.post<UnknownAllergyCheckResponse>('/drug-interactions/allergy-check', {
        drugName: name,
        allergies: this.allergies
      }).pipe(
        map((response) => normalizeAllergyResponse(response)),
        catchError(() =>
          of<DrugAllergyConflict>({
            conflict: false,
            unavailable: true,
            source: 'api',
            message: 'Drug-allergy check unavailable - verify manually before prescribing'
          })
        )
      )
    );
    this.interactionService.setAllergyConflict(allergyCacheKey, apiAllergyConflict);
    this.interactionCheckUnavailable = Boolean(apiAllergyConflict.unavailable);
    if (apiAllergyConflict.conflict) {
      this.activeAllergyConflict = apiAllergyConflict;
      return;
    }

    this.activeAllergyConflict = null;

    const nextItems = this.getNextItems(action.mode, current);
    const interactionCacheKey = this.interactionService.buildInteractionCacheKey(nextItems);
    const cachedWarningState = this.interactionService.getCachedInteractionResult(interactionCacheKey);
    if (cachedWarningState) {
      this.interactionCheckUnavailable = cachedWarningState.unavailable;
      this.applyInteractionWarnings(cachedWarningState.warnings);
    } else {
      const localWarnings = this.interactionService.evaluateDrugInteractions(nextItems);
      if (localWarnings.length > 0) {
        const localResult: DrugInteractionResult = {
          unavailable: false,
          warnings: localWarnings,
          source: 'local'
        };
        this.interactionService.setInteractionResult(interactionCacheKey, localResult);
        this.interactionCheckUnavailable = localResult.unavailable;
        this.applyInteractionWarnings(localResult.warnings);
      } else {
        const apiResult = await firstValueFrom(
          this.apiService.post<UnknownInteractionCheckResponse>('/drug-interactions/check', {
            drugs: nextItems.map((item) => ({
              medicineName: item.medicineName,
              genericName: item.genericName ?? null,
              strength: item.strength ?? null,
              route: item.route ?? null,
              frequency: item.frequency ?? null
            }))
          }).pipe(
            map((response) => normalizeInteractionResponse(response, nextItems)),
            catchError(() =>
              of<DrugInteractionResult>({
                unavailable: true,
                warnings: [],
                source: 'api'
              })
            )
          )
        );
        this.interactionService.setInteractionResult(interactionCacheKey, apiResult);
        this.interactionCheckUnavailable = apiResult.unavailable;
        this.applyInteractionWarnings(apiResult.warnings);
      }
    }

    if (action.mode === 'update' && this.editIdx >= 0) {
      this.applyUpdate(nextItems[this.editIdx]);
      return;
    }

    this.addNewMedicine(nextItems[nextItems.length - 1]);
  }

  cancelConflict(): void {
    this.activeAllergyConflict = null;
    this.pendingMedicineAction = null;
    this.awaitingOverrideReason = false;
    this.overrideReason = '';
  }

  prepareOverride(): void {
    this.awaitingOverrideReason = true;
  }

  confirmOverride(): void {
    if (!this.overrideReason.trim()) {
      return;
    }

    const current = this.form.getRawValue();
    const nextItem = this.buildItem(current);
    const item = this.editIdx >= 0
      ? { ...this.medicines[this.editIdx], ...nextItem, id: this.medicines[this.editIdx]?.id ?? nextItem.id }
      : nextItem;

    if (this.editIdx >= 0) {
      this.medicines = this.medicines.map((existing, index) => (index === this.editIdx ? item : existing));
      this.editIdx = -1;
    } else {
      this.medicines = [...this.medicines, item];
    }

    this.activeAllergyConflict = null;
    this.pendingMedicineAction = null;
    this.awaitingOverrideReason = false;
    this.emitAndClear();
    this.refreshInteractionWarnings();
  }

  editMedicine(idx: number): void {
    if (this.isReadOnlyFields) {
      return;
    }
    const m = this.medicines[idx];
    if (!m) return;
    this.editIdx = idx;
    this.form.patchValue({
      medicineName: m.medicineName,
      strength: m.strength,
      dosage: m.dosageForm,
      dose: m.dose || '1',
      uom: m.unitOfMeasure || 'TAB',
      route: m.route || 'PO',
      frequency: m.frequency || 'once a day',
      duration: m.duration || '',
      quantity: m.quantity,
      instructions: m.instructions || ''
    });
  }

  removeMedicine(idx: number): void {
    if (this.isReadOnlyFields) {
      return;
    }
    this.medicines = this.medicines.filter((_, i) => i !== idx);
    if (this.editIdx === idx) this.editIdx = -1;
    else if (this.editIdx > idx) this.editIdx--;
    this.itemsChange.emit([...this.medicines]);
    this.refreshInteractionWarnings();
  }

  openInteractionDetails(warning: DrugInteractionWarning): void {
    this.selectedInteraction = warning;
    this.interactionDetailsOpen = true;
  }

  closeInteractionDetails(): void {
    this.interactionDetailsOpen = false;
    this.selectedInteraction = null;
  }

  cancelEdit(): void {
    this.editIdx = -1;
    this.emitAndClear();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeInteractionDetails();
    this.cancelConflict();
  }

  displayMed(m: PrescriptionItem): string {
    return [m.strength, m.sig, m.frequency, m.duration].filter((x) => !!x).join(', ');
  }

  buildAllergyMessage(conflict: DrugAllergyConflict): string {
    return conflict.message || `Allergy Alert - ${this.form.get('medicineName')?.value || 'This medicine'} matches a recorded allergy: ${conflict.allergyName || 'an allergen'}. Review before adding.`;
  }

  private applyUpdate(updated: PrescriptionItem): void {
    if (this.editIdx < 0) return;
    if (!updated) return;
    this.medicines = this.medicines.map((existing, index) => (index === this.editIdx ? { ...updated, id: existing.id } : existing));
    this.editIdx = -1;
    this.emitAndClear();
    this.refreshInteractionWarnings();
  }

  private addNewMedicine(item: PrescriptionItem): void {
    this.medicines = [...this.medicines, item];
    this.emitAndClear();
    this.refreshInteractionWarnings();
  }

  private getNextItems(mode: 'add' | 'update', value: any): PrescriptionItem[] {
    const nextItem = this.buildItem(value);
    if (mode === 'update' && this.editIdx >= 0) {
      return this.medicines.map((existing, index) => (index === this.editIdx ? { ...nextItem, id: existing.id } : existing));
    }
    return [...this.medicines, nextItem];
  }

  private applyInteractionWarnings(warnings: DrugInteractionWarning[]): void {
    const nextWarnings: Record<string, DrugInteractionWarning> = {};
    for (const warning of warnings) {
      nextWarnings[warning.medicineKey] = warning;
    }
    this.interactionWarnings = nextWarnings;
  }

  private refreshInteractionWarnings(): void {
    const cacheKey = this.interactionService.buildInteractionCacheKey(this.medicines);
    const cachedWarningState = this.interactionService.getCachedInteractionResult(cacheKey);
    if (cachedWarningState) {
      this.interactionCheckUnavailable = cachedWarningState.unavailable;
      this.applyInteractionWarnings(cachedWarningState.warnings);
      return;
    }

    const localWarnings = this.interactionService.evaluateDrugInteractions(this.medicines);
    if (localWarnings.length > 0) {
      const localResult: DrugInteractionResult = {
        unavailable: false,
        warnings: localWarnings,
        source: 'local'
      };
      this.interactionService.setInteractionResult(cacheKey, localResult);
      this.interactionCheckUnavailable = localResult.unavailable;
      this.applyInteractionWarnings(localResult.warnings);
      return;
    }

    this.apiService.post<UnknownInteractionCheckResponse>('/drug-interactions/check', {
      drugs: this.medicines.map((item) => ({
        medicineName: item.medicineName,
        genericName: item.genericName ?? null,
        strength: item.strength ?? null,
        route: item.route ?? null,
        frequency: item.frequency ?? null
      }))
    }).pipe(
      map((response) => normalizeInteractionResponse(response, this.medicines)),
      catchError(() =>
        of<DrugInteractionResult>({
          unavailable: true,
          warnings: [],
          source: 'api'
        })
      )
    ).subscribe((result) => {
      this.interactionService.setInteractionResult(cacheKey, result);
      this.interactionCheckUnavailable = result.unavailable;
      this.applyInteractionWarnings(result.warnings);
    });
  }

  private getFrequencyCode(frequencyLabel: string): string | undefined {
    if (!frequencyLabel) return undefined;
    const freq = MEDICATION_FREQUENCY_MASTERS.find((f) => f.dosage_desc === frequencyLabel);
    return freq ? freq.dosage_no.trim() : undefined;
  }

  private getUomDescription(uomValue: string): string | undefined {
    if (!uomValue) return undefined;
    const uom = MEDICATION_UOM_MASTERS.find((u) => u.unit_of_measure === uomValue);
    return uom ? uom.description.trim() || uom.unit_of_measure : uomValue;
  }

  private buildItem(v: any): PrescriptionItem {
    const sig = this.buildSig(v) || String(v.medicineName ?? '').trim();
    return {
      id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      medicineName: String(v.medicineName ?? '').trim(),
      strength: String(v.strength ?? '').trim(),
      dosageForm: String(v.dosage ?? 'Other').trim() || 'Other',
      quantity: Math.max(1, Number(v.quantity) || 1),
      sig,
      dose: v.dose || undefined,
      frequency: v.frequency || undefined,
      frequencyCode: this.getFrequencyCode(v.frequency),
      duration: v.duration || undefined,
      route: v.route || undefined,
      routeDescription: this.getRouteDescription(v.route) || undefined,
      unitOfMeasure: v.uom || undefined,
      unitOfMeasureDescription: this.getUomDescription(v.uom),
      instructions: v.instructions || undefined
    };
  }

  private emitAndClear(): void {
    this.itemsChange.emit([...this.medicines]);
    this.form.patchValue({
      medicineName: '',
      strength: '',
      dosage: '',
      dose: '1',
      uom: 'TAB',
      route: 'PO',
      frequency: 'once a day',
      duration: '',
      quantity: 1,
      instructions: ''
    });
  }

  private getRouteDescription(routeCode: string): string {
    if (!routeCode) return '';
    const route = MEDICATION_ROUTE_MASTERS.find(r => r.route_code === routeCode);
    return route ? route.route_description : routeCode;
  }

  private buildSig(v: any): string {
    if (!v.medicineName || !v.dose) return '';
    const parts: string[] = ['take', String(v.dose)];
    if (v.uom) parts.push(String(v.uom).toLowerCase());
    if (v.route) {
      const adverb = this.routeAdverbs[v.route] || `via ${this.getRouteDescription(v.route).toLowerCase()}`;
      parts.push(adverb);
    }
    if (v.frequency) parts.push(String(v.frequency).toLowerCase());
    if (v.instructions) parts.push(String(v.instructions).toLowerCase());
    return parts.join(' ');
  }
}
