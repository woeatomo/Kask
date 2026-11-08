export type CommunityType = 'RT' | 'RW';
export type MemberRole = 'ketua' | 'pengurus' | 'warga';
export type MemberStatus = 'pending' | 'active' | 'rejected' | 'inactive';
export type DueKind = 'wajib' | 'sukarela';
export type DueFrequency = 'bulanan' | 'sekali';
export type BillStatus = 'belum_bayar' | 'menunggu_verifikasi' | 'lunas';
export type PaymentStatus = 'menunggu' | 'diterima' | 'ditolak';
export type PaymentMethod = 'tunai' | 'transfer' | 'qris' | 'lainnya';
export type CashType = 'masuk' | 'keluar';
export type CommunityPlan = 'free' | 'premium';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_super_admin: boolean;
}

export interface Community {
  id: string;
  name: string;
  type: CommunityType;
  rw_number: string;
  rt_number: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  provinsi: string | null;
  address: string | null;
  bank_info: string | null;
  invite_code: string;
  is_active: boolean;
  plan: CommunityPlan;
  /** null + premium = tanpa batas waktu */
  plan_expires_at: string | null;
}

export interface RtUnit {
  id: string;
  community_id: string;
  rt_number: string;
  name: string | null;
}

export interface Membership {
  id: string;
  community_id: string;
  user_id: string;
  role: MemberRole;
  position: string | null;
  status: MemberStatus;
  rt_unit_id: string | null;
  /** Pengurus yang wewenangnya dibatasi ke satu RT (komunitas RW) */
  managed_rt_unit_id: string | null;
  address: string | null;
  joined_at: string;
}

export interface MembershipWithCommunity extends Membership {
  communities: Community;
}

export interface MemberRow extends Membership {
  profiles: Pick<Profile, 'full_name' | 'phone'> | null;
  rt_units: Pick<RtUnit, 'rt_number'> | null;
}

export interface Due {
  id: string;
  community_id: string;
  name: string;
  description: string | null;
  kind: DueKind;
  frequency: DueFrequency;
  amount: number | null;
  target_amount: number | null;
  rt_unit_id: string | null;
  due_day: number;
  is_active: boolean;
  created_at: string;
}

export interface Bill {
  id: string;
  community_id: string;
  due_id: string;
  membership_id: string;
  period: string;
  amount: number;
  due_date: string | null;
  status: BillStatus;
  paid_at: string | null;
}

export interface Payment {
  id: string;
  community_id: string;
  due_id: string;
  membership_id: string;
  bill_id: string | null;
  amount: number;
  method: PaymentMethod;
  proof_path: string | null;
  note: string | null;
  status: PaymentStatus;
  verified_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface CashTransaction {
  id: string;
  community_id: string;
  type: CashType;
  amount: number;
  category: string;
  description: string | null;
  trx_date: string;
  payment_id: string | null;
  /** null = kas RW / kas utama */
  rt_unit_id: string | null;
  attachment_path: string | null;
  created_at: string;
}

export interface News {
  id: string;
  community_id: string;
  title: string;
  body: string;
  image_path: string | null;
  /** null = untuk seluruh komunitas */
  rt_unit_id: string | null;
  is_pinned: boolean;
  author_id: string | null;
  published_at: string;
  profiles?: Pick<Profile, 'full_name'> | null;
}

export interface CashReport {
  opening_balance: number;
  income: number;
  expense: number;
  closing_balance: number;
  by_category: { type: CashType; category: string; total: number }[];
}

export interface AppNotification {
  id: string;
  user_id: string;
  community_id: string | null;
  title: string;
  body: string;
  url: string | null;
  created_at: string;
  read_at: string | null;
}
