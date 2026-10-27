/** A-stage collection. The legacy pawmemo-demo:v1 key is deliberately never read or written here. */
export const COLLECTION_KEY = 'pawmemo:lifecycle:v1';
export const COLLECTION_VERSION = 1;
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export interface PetFields { name: string; kind: string; breed: string; birthday: string; avatar: string | null }
export interface Pet extends PetFields { id: string; archived: boolean; createdAt: string; updatedAt: string }
export interface PetDraft { id: string; petId: string | null; fields: PetFields }
export interface Collection {
  localMode: boolean;
  activePetId: string | null;
  pets: Pet[];
  petDrafts: PetDraft[];
  // Later approved batches will define these records and their schema migrations.
  memories: never[];
  tasks: never[];
}
export const emptyFields = (): PetFields => ({ name: '', kind: '', breed: '', birthday: '', avatar: null });
export const emptyCollection = (): Collection => ({ localMode: false, activePetId: null, pets: [], petDrafts: [], memories: [], tasks: [] });
export const copyCollection = (value: Collection): Collection => JSON.parse(JSON.stringify(value));
export const newId = (kind: 'draft' | 'pet' | 'task' | 'memory') => `${kind}_${crypto.randomUUID()}`;
export function validatePet(fields: PetFields): Partial<Record<keyof PetFields, string>> {
  const e: Partial<Record<keyof PetFields, string>> = {};
  if (!fields.name.trim() || fields.name.length > 80) e.name = '请填写 1–80 字的宠物名字。';
  if (!['猫', '狗', '其他'].includes(fields.kind)) e.kind = '请选择宠物类型。';
  if (fields.breed.length > 80) e.breed = '品种最多 80 字。';
  if (fields.birthday) {
    const d = new Date(`${fields.birthday}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.birthday) || !Number.isFinite(+d) || d.toISOString().slice(0, 10) !== fields.birthday) e.birthday = '请填写有效生日（YYYY-MM-DD），也可以留空。';
  }
  return e;
}
function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function text(v: unknown, max: number): v is string { return typeof v === 'string' && v.length <= max; }
function avatar(v: unknown): v is string | null { return v === null || (text(v, 2800000) && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v)); }
function fields(v: unknown): v is PetFields { return record(v) && text(v.name, 80) && text(v.kind, 20) && text(v.breed, 80) && text(v.birthday, 10) && avatar(v.avatar); }
function identifier(v: unknown): v is string { return typeof v === 'string' && /^[a-z]+_[\w-]{1,100}$/.test(v); }
function stamp(v: unknown): v is string { return text(v, 40) && Number.isFinite(Date.parse(v)); }
function pet(v: unknown): v is Pet { return fields(v) && record(v) && identifier(v.id) && typeof v.archived === 'boolean' && stamp(v.createdAt) && stamp(v.updatedAt) && Object.keys(validatePet(v)).length === 0; }
function draft(v: unknown): v is PetDraft { return record(v) && identifier(v.id) && (v.petId === null || identifier(v.petId)) && fields(v.fields); }
function unique(items: {id: string}[]): boolean { return new Set(items.map(x => x.id)).size === items.length; }
function valid(v: unknown): v is Collection {
  if (!record(v) || typeof v.localMode !== 'boolean' || !Array.isArray(v.pets) || !v.pets.every(pet) || !unique(v.pets) || !Array.isArray(v.petDrafts) || !v.petDrafts.every(draft) || !unique(v.petDrafts)) return false;
  if (!Array.isArray(v.memories) || v.memories.length || !Array.isArray(v.tasks) || v.tasks.length) return false;
  if (v.activePetId !== null && !v.pets.some(p => p.id === v.activePetId && !p.archived)) return false;
  if (v.pets.some(p => !p.archived) && v.activePetId === null) return false;
  if (!v.localMode && (v.pets.length || v.petDrafts.length)) return false;
  const pets = v.pets;
  if (v.petDrafts.some(d => d.petId !== null && !pets.some(p => p.id === d.petId && !p.archived))) return false;
  return new Set(v.petDrafts.filter(d => d.petId).map(d => d.petId)).size === v.petDrafts.filter(d => d.petId).length;
}
export type ReadResult = { kind: 'ready'; data: Collection } | { kind: 'denied' | 'corrupt' | 'version'; recoverable: Collection };
function recover(value: unknown): Collection {
  const data = emptyCollection();
  if (!record(value) || value.localMode !== true) return data;
  data.localMode = true;
  if (Array.isArray(value.pets)) {
    for (const item of value.pets) if (pet(item) && !data.pets.some(p => p.id === item.id)) data.pets.push({ ...item });
  }
  data.activePetId = data.pets.find(p => !p.archived && p.id === value.activePetId)?.id ?? data.pets.find(p => !p.archived)?.id ?? null;
  // Do not reinterpret damaged or future task/memory records as empty saved records.
  // Recovery is confined to a non-writing temporary session.
  return data;
}
export class StorageWriteError extends Error {
  constructor(public readonly kind: 'unread'|'conflict'|'invalid', message: string) { super(message);this.name='StorageWriteError'; }
}
export class CollectionStorage {
  private baseline: string | null | undefined;
  private writable = false;
  private blocked: StorageWriteError = new StorageWriteError('unread','原资料尚未成功读取，本次内容不会覆盖原资料。');
  constructor(private getStorage: () => Pick<Storage, 'getItem' | 'setItem'>) {}
  read(): ReadResult {
    this.writable = false;
    this.blocked = new StorageWriteError('unread','原资料尚未成功读取，本次内容不会覆盖原资料。');
    let raw: string | null;
    try { raw = this.getStorage().getItem(COLLECTION_KEY); } catch { return { kind: 'denied', recoverable: emptyCollection() }; }
    if (raw === null) { this.baseline = null; this.writable = true; return { kind: 'ready', data: emptyCollection() }; }
    let envelope: unknown;
    try { envelope = JSON.parse(raw); } catch { return { kind: 'corrupt', recoverable: emptyCollection() }; }
    if (record(envelope) && typeof envelope.version === 'number' && envelope.version !== COLLECTION_VERSION) return { kind: 'version', recoverable: emptyCollection() };
    if (!record(envelope) || envelope.version !== COLLECTION_VERSION || !valid(envelope.data)) return { kind: 'corrupt', recoverable: recover(record(envelope) ? envelope.data : null) };
    this.baseline = raw; this.writable = true;
    return { kind: 'ready', data: copyCollection(envelope.data) };
  }
  write(data: Collection): void {
    if (!this.writable) throw this.blocked;
    if (!valid(data)) throw new StorageWriteError('invalid','资料校验失败，当前输入仍保留。');
    const storage = this.getStorage();
    if (storage.getItem(COLLECTION_KEY) !== this.baseline) { this.writable = false;this.blocked = new StorageWriteError('conflict','本机资料已在其他页面发生变化。请先读取最新资料；本页输入仍保留，不会直接覆盖新版本。');throw this.blocked; }
    const raw = JSON.stringify({ version: COLLECTION_VERSION, data });
    storage.setItem(COLLECTION_KEY, raw); // Only a successful write advances the baseline.
    this.baseline = raw;
  }
}
export function savePet(data: Collection, draftId: string, now = new Date().toISOString()): Collection {
  const next = copyCollection(data), d = next.petDrafts.find(x => x.id === draftId);
  if (!d || Object.keys(validatePet(d.fields)).length) throw new Error('请检查宠物资料。');
  const existing = d.petId ? next.pets.find(p => p.id === d.petId && !p.archived) : null;
  if (d.petId && !existing) throw new Error('该宠物不可编辑，输入已保留。');
  const id = existing?.id ?? `pet_${d.id.slice('draft_'.length)}`;
  if (!existing && next.pets.some(p=>p.id===id)) throw new StorageWriteError('conflict','这份档案已在其他页面创建，请先读取最新资料并检查本页输入。');
  const value: Pet = { ...d.fields, id, archived: false, createdAt: existing?.createdAt ?? now, updatedAt: now };
  next.pets = existing ? next.pets.map(p => p.id === id ? value : p) : [...next.pets, value];
  next.activePetId = id; next.petDrafts = next.petDrafts.filter(x => x.id !== draftId);
  return next;
}
export function archivePet(data: Collection, petId: string, archived: boolean): Collection {
  const next = copyCollection(data), p = next.pets.find(x => x.id === petId);
  if (!p) throw new Error('找不到宠物资料。');
  if (next.petDrafts.some(d => d.petId === petId)) throw new Error('请先处理这只宠物尚未保存的档案草稿。');
  p.archived = archived; p.updatedAt = new Date().toISOString();
  if (archived && next.activePetId === petId) next.activePetId = next.pets.find(x => !x.archived)?.id ?? null;
  if (!archived) next.activePetId = petId;
  return next;
}
