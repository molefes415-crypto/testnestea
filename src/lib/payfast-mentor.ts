import { z } from 'zod'

export const mentorIdSchema = z.coerce.number().int().positive().max(2147483647)

export function paymentMentorId(raw: unknown): number {
  return mentorIdSchema.parse(z.object({ mentor_id: mentorIdSchema }).parse(raw).mentor_id)
}

export const mentorActivationSchema = z.object({
  payment_id: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
  provider_payment_id: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
  admin_id: mentorIdSchema,
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
  amount: z.literal('580.00'),
  currency: z.literal('ZAR'),
  status: z.literal('paid'),
})