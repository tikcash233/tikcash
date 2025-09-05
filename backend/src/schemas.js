import { z } from 'zod';

export const CreatorCreateSchema = z.object({
  tiktok_username: z.string().min(1),
  display_name: z.string().min(1),
  bio: z.string().optional(),
  profile_image: z.string().url().optional().or(z.literal('')).optional(),
  follower_count: z.number().int().nonnegative().optional(),
  phone_number: z.string().optional(),
  preferred_payment_method: z.enum(['momo','bank_transfer']).optional(),
  is_verified: z.boolean().optional(),
  category: z.enum(['comedy','dance','music','education','lifestyle','fashion','food','sports','other']).optional(),
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
