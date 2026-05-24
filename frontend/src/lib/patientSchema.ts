import { z } from 'zod'

export const patientFormSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100, 'Max 100 characters'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Max 100 characters'),
  prefix: z.string().max(20, 'Max 20 characters').optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other', 'unknown'], {
    errorMap: () => ({ message: 'Please select a gender' }),
  }),
  birth_date: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((v) => {
      const d = new Date(v)
      return !isNaN(d.getTime())
    }, 'Invalid date')
    .refine((v) => new Date(v) <= new Date(), 'Date of birth cannot be in the future')
    .refine((v) => new Date(v) >= new Date('1900-01-01'), 'Date of birth cannot be before 1900'),
})

export type PatientFormValues = z.infer<typeof patientFormSchema>
