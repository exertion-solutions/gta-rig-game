import type { MissionDef } from '../types'
import { m1 } from './m1'
import { m2 } from './m2'
import { m3 } from './m3'
import { m4 } from './m4'
import { m5 } from './m5'
import { m6 } from './m6'
import { m7 } from './m7'
import { m8 } from './m8'

/** Las 8 misiones iniciales, en el orden del spec. Cada una se omite sola (requires) si falta su dato. */
export const ALL_MISSIONS: MissionDef[] = [m1, m2, m3, m4, m5, m6, m7, m8]
