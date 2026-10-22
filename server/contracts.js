import { z } from 'zod'
export const category = z.enum(['communication', 'technical', 'experience'])
export const sessionInput = z.object({
  resume: z.string().trim().min(50).max(24000), role: z.string().trim().min(2).max(100),
  level: z.enum(['junior', 'mid', 'senior']),
}).strict()
export const question = z.object({ id:z.number().int().min(1).max(6), category, question:z.string().min(10).max(1200) }).strict()
export const interviewPlan = z.object({ introduction:z.string().min(10).max(1500), questions:z.array(question).length(6) }).strict()
export function validatePlan(value) {
  const plan = interviewPlan.parse(value)
  if (plan.questions.some((q,i) => q.id !== i+1) || category.options.some(c => plan.questions.filter(q => q.category === c).length !== 2)) throw new Error('Invalid question sequence or category distribution')
  return plan
}
export const assessment = z.object({
  score:z.number().int().min(0).max(100),
  strengths:z.array(z.string().min(3).max(600)).min(1).max(3),
  improvements:z.array(z.string().min(3).max(600)).min(1).max(3),
  exampleAnswer:z.string().min(20).max(3000),
}).strict()
export const answerInput = z.object({ questionId:z.number().int().min(1).max(6), answer:z.string().trim().min(5).max(8000) }).strict()
