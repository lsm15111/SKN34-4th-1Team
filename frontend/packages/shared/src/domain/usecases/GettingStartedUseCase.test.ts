import { describe, expect, it, vi } from 'vitest'
import type { GettingStartedGuide } from '../entities/GettingStarted'
import type { GettingStartedRepository } from '../repositories/GettingStartedRepository'
import { GettingStartedUseCase } from './GettingStartedUseCase'

const guide: GettingStartedGuide = { visible: true, closed: false, completedAt: null, steps: [{ id: 'SIGN_UP', status: 'DONE' }] }

function repository(): GettingStartedRepository {
  return { guide: vi.fn(async () => guide), setClosed: vi.fn(async (closed: boolean) => ({ ...guide, visible: !closed, closed })) }
}

describe('GettingStartedUseCase', () => {
  it('reads the guide and saves close as closed=true and reopen as closed=false', async () => {
    const repo = repository()
    const useCase = new GettingStartedUseCase(repo)
    const signal = new AbortController().signal

    expect(await useCase.guide(signal)).toBe(guide)
    expect(repo.guide).toHaveBeenCalledWith(signal)
    expect(await useCase.close()).toMatchObject({ visible: false, closed: true })
    expect(repo.setClosed).toHaveBeenLastCalledWith(true, undefined)
    expect(await useCase.reopen(signal)).toMatchObject({ visible: true, closed: false })
    expect(repo.setClosed).toHaveBeenLastCalledWith(false, signal)
  })
})
