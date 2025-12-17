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
  pin: z.string().regex(/^\d{4}$/, 'Enter a 4-digit PIN').optional(),
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
  // 4-digit recovery PIN for password resets without email
  recovery_pin: z.string().regex(/^\d{4}$/, 'Enter a 4-digit PIN'),
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
  // Accept either an email (legacy clients) or an identifier (email or username)
  email: z.string().email().optional(),
  identifier: z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    return v.trim();
  }, z.string().min(1).optional()),
  password: z.string().min(8),
}).refine((val) => !!(val.email || val.identifier), { message: 'email or identifier is required' });

export const RequestVerifySchema = z.object({
  email: z.string().email(),
});

export const VerifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
});

// Password reset using 4-digit recovery PIN (email or username)
export const ResetWithPinSchema = z
  .object({
    email: z.string().email().optional(),
    identifier: z.string().min(1).optional(),
    pin: z.string().regex(/^\d{4}$/, 'Enter the 4-digit PIN'),
    new_password: z.string().min(8),
  })
  .superRefine((val, ctx) => {
    if (!val.email && !val.identifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide email or username',
        path: ['identifier'],
      });
    }
  });

// Change password for logged-in users
export const ChangePasswordSchema = z.object({
  current_password: z.string().min(8),
  new_password: z.string().min(8),
});

export const ChangePasswordWithPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'Enter the 4-digit PIN'),
  new_password: z.string().min(8),
});

export const ChangePinSchema = z.object({
  current_password: z.string().min(8),
  new_pin: z.string().regex(/^\d{4}$/, 'Enter the 4-digit PIN'),
});
