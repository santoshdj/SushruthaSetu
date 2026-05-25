import { z } from 'zod'

const optStr = z.string().optional().or(z.literal(''))

export const patientFormSchema = z.object({
  // Identity — mandatory
  first_name: z.string().min(1, 'First name is required').max(100, 'Max 100 characters'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Max 100 characters'),
  prefix: z.string().max(20, 'Max 20 characters').optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other', 'unknown'], {
    errorMap: () => ({ message: 'Please select a gender' }),
  }),
  birth_date: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((v) => !isNaN(new Date(v).getTime()), 'Invalid date')
    .refine((v) => new Date(v) <= new Date(), 'Date of birth cannot be in the future')
    .refine((v) => new Date(v) >= new Date('1900-01-01'), 'Date of birth cannot be before 1900'),
  // Contact — optional
  phone: optStr,
  address_line: optStr,
  address_city: optStr,
  address_state: optStr,
  address_postal_code: optStr,
  address_country: optStr,
  // Demographics — optional
  marital_status: z.enum(['Married', 'Single', 'Divorced', 'Widowed', 'Separated', 'Domestic Partner', 'Unknown']).optional().or(z.literal('')),
  multiple_birth: z.enum(['true', 'false']).optional().or(z.literal('')),
  language: optStr,
  mothers_maiden_name: optStr,
  birth_place: optStr,
  // US Core Clinical — optional
  race: z.enum(['White', 'Black or African American', 'Asian', 'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander', 'Other Race']).optional().or(z.literal('')),
  ethnicity: z.enum(['Hispanic or Latino', 'Not Hispanic or Latino']).optional().or(z.literal('')),
  birth_sex: z.enum(['Male', 'Female', 'Unknown']).optional().or(z.literal('')),
})

export type PatientFormValues = z.infer<typeof patientFormSchema>
