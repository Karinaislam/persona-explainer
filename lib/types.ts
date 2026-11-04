export type Persona = {
  id: string
  name: string
  age: number
  interests: string[]
  level: string
  tone: string
  visualStyle: string
}

export type Shot = { visualPrompt: string; narration: string; overlay?: string }

export type Answer = {
  summary: string
  sections: { heading: string; body: string }[]
  example: string
  keyPoints: string[] // recap
  takeaway: string
}

export type Script = { answer: Answer; styleBible: string; shots: Shot[] } // exactly 4 shots

export type JobStatus = { state: 'none' | 'pending' | 'done' | 'error'; step: string; error?: string }
