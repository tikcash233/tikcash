import { z } from 'zod';

export const CreatorCreateSchema = z.object({
  tiktok_username: z.string().min(1),
  display_name: z.string().min(1),
  bio: z.string().optional(),
  profile_image: z.string().url().optional().or(z.literal('')).optional(),
  follower_count: z.number().int().nonnegative().optional(),
  phone_number: z.string()
    .regex(/^\+233\d{9}$/, 'Phone must be Ghana format +233#########'),
  preferred_payment_method: z.literal('momo').default('momo'),
  is_verified: z.boolean().optional(),
  category: z.enum(['comedy','dance','music','education','lifestyle','fashion','food','sports','other']).default('other').optional(),
  created_by: z.string().email().optional(),
});

export const CreatorUpdateSchema = CreatorCreateSchema.partial();

export const TransactionCreateSchema = z.object({
  creator_id: z.string().uuid(),
  supporter_name: z.string().optional(),
  amount: z.number().refine((v) => isFinite(v), 'Amount must be a number'),
  message: z.string().optional(),
  transaction_type: z.enum(['tip','withdrawal','refund']),
  status: z.enum(['pending','completed','failed']).optional(),
  payment_reference: z.string().optional(),
  momo_number: z.string().optional(),
});

// Auth
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  // Name is optional for all users; treat empty strings as undefined
  name: z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    return t.length ? t : undefined;
  }, z.string().optional()),
  role: z.enum(['creator', 'supporter']).default('supporter'),
    // Optional creator fields collected at registration if role = 'creator'
    tiktok_username: z.preprocess((v) => {
      if (typeof v !== 'string') return v;
      const t = v.trim();
      return t.length ? t : undefined;
    }, z.string().min(1).optional()),
    display_name: z.preprocess((v) => {
      if (typeof v !== 'string') return v;
      const t = v.trim();
      return t.length ? t : undefined;
    }, z.string().min(1).optional()),
  phone_number: z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    return t.length ? t : undefined;
  }, z.string().optional()),
  preferred_payment_method: z.enum(['momo']).optional(),
    category: z.enum(['comedy', 'dance', 'music', 'education', 'lifestyle', 'fashion', 'food', 'sports', 'other']).optional(),
}).superRefine((val, ctx) => {
  // At registration time, creator fields are optional to keep signup simple.
  // If the user provided a phone number, validate the Ghana format.
  if (val.phone_number) {
    const ph = String(val.phone_number);
    if (!/^\+233\d{9}$/.test(ph)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Phone must be Ghana format +233#########', path: ['phone_number'] });
    }
  }
  // If provided, only Mobile Money is accepted
  if (val.preferred_payment_method && val.preferred_payment_method !== 'momo') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Only Mobile Money is supported', path: ['preferred_payment_method'] });
  }
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RequestVerifySchema = z.object({
  email: z.string().email(),
});

export const VerifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
});
