import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanQuotaExceededError } from '@govbiz/shared/domain/errors/PlanQuotaError'

import { receivedProposalBox, sentPendingProposal } from '../../fixtures/partnerProposals'
import { PartnerProposalRepositoryImpl } from '../../repositories/PartnerProposalRepositoryImpl'
import { browsePartnerProposalsApi, respondPartnerProposalApi, sendPartnerProposalApi } from '../partnerProposalApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('partnerProposalApi', () => {
  it('sends, reads, responds, and browses with cookies on the expected paths', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(sentPendingProposal, 201))
      .mockResolvedValueOnce(jsonResponse({ ...sentPendingProposal, status: 'WITHDRAWN' }))
      .mockResolvedValueOnce(jsonResponse(receivedProposalBox))
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendPartnerProposalApi(101, { message: '제안', shareProfile: true })).resolves.toMatchObject({ id: 303 })
    await expect(respondPartnerProposalApi(303, 'withdraw')).resolves.toMatchObject({ status: 'WITHDRAWN' })
    await expect(browsePartnerProposalsApi('received')).resolves.toMatchObject({ pendingCount: 1 })

    const calls = fetchMock.mock.calls as [string, RequestInit][]
    expect(new URL(calls[0]![0]).pathname).toBe('/api/v1/partners/recruitments/101/proposals')
    expect(calls[0]![1].method).toBe('POST')
    expect(JSON.parse(calls[0]![1].body as string)).toEqual({ message: '제안', shareProfile: true })
    expect(new URL(calls[1]![0]).pathname).toBe('/api/v1/partners/proposals/303/withdraw')
    expect(calls[1]![1].method).toBe('POST')
    const boxUrl = new URL(calls[2]![0])
    expect(boxUrl.pathname).toBe('/api/v1/me/proposals')
    expect(boxUrl.searchParams.get('box')).toBe('received')
    expect(calls.every(([, init]) => init.credentials === 'include')).toBe(true)
  })

  it('rejects a box that differs from the request and responses missing the contract', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ...receivedProposalBox, box: 'sent' }))
      .mockResolvedValueOnce(jsonResponse({ ...sentPendingProposal, counterpart: undefined }, 201))
    vi.stubGlobal('fetch', fetchMock)

    await expect(browsePartnerProposalsApi('received')).rejects.toThrow('요청한 제안함과 응답이 다릅니다.')
    await expect(sendPartnerProposalApi(101, { message: '제안', shareProfile: true })).rejects.toThrow()
  })

  it('maps business problems to outcomes and null, rethrowing the rest', async () => {
    const repository = new PartnerProposalRepositoryImpl()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(problemResponse(403, 'COMPANY_REQUIRED'))
      .mockResolvedValueOnce(problemResponse(404, 'RECRUITMENT_NOT_FOUND'))
      .mockResolvedValueOnce(problemResponse(422, 'PROPOSAL_OWN_RECRUITMENT'))
      .mockResolvedValueOnce(problemResponse(422, 'RECRUITMENT_CLOSED'))
      .mockResolvedValueOnce(problemResponse(409, 'PROPOSAL_ALREADY_SENT'))
      .mockResolvedValueOnce(problemResponse(404, 'PROPOSAL_NOT_FOUND'))
      .mockResolvedValueOnce(problemResponse(409, 'PROPOSAL_NOT_PENDING'))
      .mockResolvedValueOnce(problemResponse(403, 'PROPOSAL_ACTION_FORBIDDEN'))
      .mockResolvedValueOnce(problemResponse(401, 'AUTHENTICATION_REQUIRED'))
    vi.stubGlobal('fetch', fetchMock)

    const input = { message: '제안', shareProfile: true }
    await expect(repository.send(101, input)).resolves.toEqual({ outcome: 'company-required' })
    await expect(repository.send(101, input)).resolves.toEqual({ outcome: 'recruitment-not-found' })
    await expect(repository.send(101, input)).resolves.toEqual({ outcome: 'own-recruitment' })
    await expect(repository.send(101, input)).resolves.toEqual({ outcome: 'recruitment-closed' })
    await expect(repository.send(101, input)).resolves.toEqual({ outcome: 'already-sent' })
    await expect(repository.respond(999, 'accept')).resolves.toEqual({ outcome: 'not-found' })
    await expect(repository.respond(303, 'accept')).resolves.toEqual({ outcome: 'not-pending' })
    await expect(repository.respond(303, 'accept')).resolves.toEqual({ outcome: 'forbidden' })
    await expect(repository.respond(303, 'accept')).rejects.toMatchObject({ status: 401 })
  })

  it('passes this month\'s proposal limit through as the shared plan error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      status: 429, code: 'PLAN_QUOTA_EXCEEDED', feature: 'PARTNER_PROPOSAL', period: 'MONTH', plan: 'FREE', limit: 3, used: 3,
      resetsAt: '2026-11-01T00:00:00+09:00', retryAfterSeconds: 100,
    }), { status: 429, headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '100' } })))

    const sent = await new PartnerProposalRepositoryImpl().send(101, { message: '제안', shareProfile: true }).catch((error: unknown) => error)
    expect(sent).toBeInstanceOf(PlanQuotaExceededError)
    expect((sent as Error).message).toBe('이번 달 파트너 제안 3건을 모두 보냈어요. 철회한 제안도 횟수에 들어가요. 11월 1일에 다시 채워져요.')
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problemResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ code }), { status, headers: { 'Content-Type': 'application/problem+json' } })
}
