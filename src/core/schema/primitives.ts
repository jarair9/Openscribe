import { z } from 'zod'

export const Vec2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
})
export type Vec2 = z.infer<typeof Vec2Schema>

export const RectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive()
})
export type Rect = z.infer<typeof RectSchema>

export const ColorSchema = z.string().min(1).max(200)

export const EasingSchema = z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut'])
export type Easing = z.infer<typeof EasingSchema>

export const DirectionSchema = z.enum(['left', 'right', 'up', 'down', 'diagonal'])
export type Direction = z.infer<typeof DirectionSchema>
