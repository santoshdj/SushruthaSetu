import { describe, it, expect } from 'vitest'
import { patientFormSchema } from '@/lib/patientSchema'

const validPatient = {
  first_name: 'Jane',
  last_name: 'Smith',
  prefix: 'Dr.',
  gender: 'female' as const,
  birth_date: '1980-06-15',
}

describe('patientFormSchema', () => {
  it('accepts a fully valid patient', () => {
    expect(() => patientFormSchema.parse(validPatient)).not.toThrow()
  })

  it('requires first name', () => {
    const result = patientFormSchema.safeParse({ ...validPatient, first_name: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('First name is required')
  })

  it('requires last name', () => {
    const result = patientFormSchema.safeParse({ ...validPatient, last_name: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Last name is required')
  })

  it('rejects first name longer than 100 characters', () => {
    const result = patientFormSchema.safeParse({ ...validPatient, first_name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Max 100 characters')
  })

  it('rejects last name longer than 100 characters', () => {
    const result = patientFormSchema.safeParse({ ...validPatient, last_name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Max 100 characters')
  })

  it('accepts prefix as an empty string', () => {
    const result = patientFormSchema.safeParse({ ...validPatient, prefix: '' })
    expect(result.success).toBe(true)
  })

  it('accepts a patient with no prefix field', () => {
    const { prefix: _omit, ...noPrefix } = validPatient
    const result = patientFormSchema.safeParse(noPrefix)
    expect(result.success).toBe(true)
  })

  it('rejects prefix longer than 20 characters', () => {
    const result = patientFormSchema.safeParse({ ...validPatient, prefix: 'a'.repeat(21) })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Max 20 characters')
  })

  it('accepts all four valid gender values', () => {
    for (const gender of ['male', 'female', 'other', 'unknown'] as const) {
      const result = patientFormSchema.safeParse({ ...validPatient, gender })
      expect(result.success, `expected gender '${gender}' to pass`).toBe(true)
    }
  })

  it('rejects an unrecognised gender value', () => {
    const result = patientFormSchema.safeParse({ ...validPatient, gender: 'nonbinary' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Please select a gender')
  })

  it('requires birth date', () => {
    const result = patientFormSchema.safeParse({ ...validPatient, birth_date: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a birth date in the future', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const result = patientFormSchema.safeParse({
      ...validPatient,
      birth_date: tomorrow.toISOString().split('T')[0],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Date of birth cannot be in the future')
  })

  it('rejects a birth date before 1900-01-01', () => {
    const result = patientFormSchema.safeParse({ ...validPatient, birth_date: '1899-12-31' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Date of birth cannot be before 1900')
  })
})
