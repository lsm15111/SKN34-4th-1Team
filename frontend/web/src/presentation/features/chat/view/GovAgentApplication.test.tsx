// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { appContainer } from '../../../../app/appContainer'
import { createAppStore } from '../../../../app/store'
import { supportProgramDetails, supportPrograms } from '../../../../data/fixtures/supportPrograms'
import { completeSearchResult } from '../../../../data/fixtures/supportProgramSearchResult'
import { emptyConversationContext } from '../../../../data/fixtures/supportProgramConversation'
import type { ApplicationDocumentGenerationJob, ApplicationForm, ApplicationFormAvailability, ApplicationFormDiscoveryJob, ApplicationPreparation } from '../../../../domain/entities/ApplicationPreparation'
import { chooseOption } from '../../../../test/selectField'
import { signedIn } from '../../../shared/auth/state/authSlice'
import { conversationHistoryOpened, conversationReset, createChatConversationSnapshot, govApplicationPrepared, govMessageSucceeded, govProgramSelected, interpretationStarted, searchStarted, searchSucceeded } from '../state/chatSlice'
import { ChatPage } from './ChatPage'

vi.mock('../hooks/useSupportProgramSearchReadiness', () => ({ useSupportProgramSearchReadiness: () => ({
  canSearch: true, isError: false, isInitialLoading: false, isRefreshing: false, refetch: vi.fn(), data: { searchState: 'SEARCHABLE' },
}) }))
vi.mock('../viewmodel/useSearchResultInterests', async (importOriginal) => ({
  ...await importOriginal<typeof import('../viewmodel/useSearchResultInterests')>(), useSearchResultInterests: () => null,
}))
vi.mock('../../../shared/plan-usage/usePlanUsage', () => {
  const usage = { usage: null, reload: vi.fn() }
  return { usePlanUsage: () => usage }
})

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const account = { email: 'admin@govbiz.local', role: 'ADMIN' as const, tier: 'ADMIN' as const,
  emailVerified: true, hasPassword: true, accountType: null, onboarded: true, company: null }
const program = { sourceCode: supportPrograms[0].sourceCode, sourceProgramId: supportPrograms[0].id, title: supportPrograms[0].title }
const form: ApplicationForm = {
  ...program, programTitle: program.title, formVersionId: 'stored-form-v1', formTitle: '사업계획서',
  sourceUrl: supportPrograms[0].sourceUrl, attachmentFileName: '사업계획서.hwpx', attachmentSha256: 'a'.repeat(64),
  verificationStatus: 'SOURCE_DOCUMENT_EXTRACTED', institutionReviewed: false,
  supportedServiceFields: ['GENERAL'], sections: [],
}
const created: ApplicationPreparation = { id: 12, inputRevision: 0, progressStage: 'PREPARING', progressRevision: 0,
  progressStageUpdatedAt: '2026-10-10T01:00:00+09:00', serviceField: 'GENERAL',
  createdAt: '2026-10-10T01:00:00+09:00', updatedAt: '2026-10-10T01:00:00+09:00', form, contents: [] }

function availability(items: ApplicationForm[]): ApplicationFormAvailability {
  return { state: { ...program, status: items.length ? 'AVAILABLE' : 'PENDING',
    reasonCode: items.length ? 'FORM_FOUND' : 'NOT_ANALYZED', nextRetryAt: null, attemptCount: 0, warnings: [] }, forms: { items } }
}

function job(status: ApplicationFormDiscoveryJob['status']): ApplicationFormDiscoveryJob {
  return { id: 17, ...program, programTitle: program.title, programSourceUrl: form.sourceUrl, status,
    createdAt: new Date().toISOString(), failureCode: null,
    result: status === 'SUCCEEDED' ? { items: [form], warnings: [], cached: false } : null }
}

function mockPreparation(items: ApplicationForm[] = [form]) {
  const useCase = appContainer.resolve('applicationPreparationUseCase')
  const detail = vi.spyOn(appContainer.resolve('getSupportProgramDetailUseCase'), 'execute').mockResolvedValue(supportProgramDetails[0])
  const lookup = vi.spyOn(useCase, 'availability').mockResolvedValue(availability(items))
  const jobs = vi.spyOn(useCase, 'discoveryJobs').mockResolvedValue([])
  const poll = vi.spyOn(useCase, 'discoveryJob').mockResolvedValue(job('SUCCEEDED'))
  const discover = vi.spyOn(useCase, 'discover').mockResolvedValue(job('SUCCEEDED'))
  const create = vi.spyOn(useCase, 'create').mockResolvedValue(created)
  const get = vi.spyOn(useCase, 'get').mockResolvedValue(created)
  const documents = vi.spyOn(useCase, 'documents').mockResolvedValue([])
  const documentJobs = vi.spyOn(useCase, 'documentJobs').mockResolvedValue([])
  const submit = vi.spyOn(useCase, 'submitDocumentJob')
  vi.spyOn(useCase, 'markDocumentJobsSeen').mockResolvedValue(undefined)
  vi.spyOn(useCase, 'markDiscoveryJobsSeen').mockResolvedValue(undefined)
  return { useCase, detail, lookup, jobs, poll, discover, create, get, documents, documentJobs, submit }
}

function addApplication(store: ReturnType<typeof createAppStore>) {
  const started = interpretationStarted({ message: '신청 준비해줘', context: emptyConversationContext })
  store.dispatch(started)
  store.dispatch(govMessageSucceeded({ requestId: started.payload.requestId, message: '양식을 확인하고 신청 준비를 시작해 주세요.',
    application: { program, message: '양식을 확인하고 신청 준비를 시작해 주세요.' } }))
  return `${started.payload.requestId}-answer`
}

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }

async function mount(restored = false, preparationId?: number) {
  const store = createAppStore()
  store.dispatch(signedIn(account))
  const search = searchStarted('사업')
  store.dispatch(search)
  store.dispatch(searchSucceeded({ ...completeSearchResult({ query: '사업', programs: [supportPrograms[0]] }), requestId: search.payload.requestId }))
  store.dispatch(govProgramSelected(program))
  const messageId = addApplication(store)
  if (preparationId !== undefined) store.dispatch(govApplicationPrepared({ accountEmail: account.email, messageId, preparationId }))
  if (restored) {
    const snapshot = createChatConversationSnapshot(store.getState().chat)
    store.dispatch(conversationReset())
    store.dispatch(conversationHistoryOpened({ accountEmail: account.email, snapshot }))
  }
  await act(async () => { render(<Provider store={store}><MemoryRouter initialEntries={['/app/chat']}><Location /><Routes>
    <Route path="/app/chat" element={<ChatPage layout="workspace" />} />
    <Route path="/app/application-preparations/:id" element={<p>신청 문서 편집기</p>} />
  </Routes></MemoryRouter></Provider>) })
  return store
}

it('restores the card, chooses a stored form and service field, and keeps the created editor in the chat', async () => {
  const second = { ...form, formVersionId: 'second-form-v1', formTitle: '수출 계획서', supportedServiceFields: ['CONSULTING', 'MARKETING'] as ApplicationForm['supportedServiceFields'] }
  const api = mockPreparation([form, second])
  const store = await mount(true)
  expect(screen.getByRole('heading', { name: `신청 준비 · ${program.title}` })).toBeTruthy()
  expect(api.discover).not.toHaveBeenCalled()
  expect(api.create).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('radio', { name: /수출 계획서/ }))
  chooseOption(screen.getByRole('combobox', { name: '신청 분야' }), 'MARKETING')
  api.create.mockRejectedValueOnce(new Error('저장 요청 실패'))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '작성 시작' })))
  expect(screen.getByText('저장 요청 실패')).toBeTruthy()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '작성 시작' })))
  expect(api.create).toHaveBeenLastCalledWith({ sourceCode: program.sourceCode, sourceProgramId: program.sourceProgramId,
    formVersionId: second.formVersionId, serviceField: 'MARKETING' }, expect.any(AbortSignal))
  expect(screen.getByRole('heading', { name: '답변 입력' })).toBeTruthy()
  expect(screen.getByTestId('location').textContent).toBe('/app/chat')
  expect(createChatConversationSnapshot(store.getState().chat).messages.at(-1)?.govApplication?.preparationId).toBe(12)
  expect(api.discover).not.toHaveBeenCalled()
})

it('saves answers, submits once, follows the job and downloads without leaving the chat', async () => {
  vi.useFakeTimers()
  const api = mockPreparation()
  let current: ApplicationPreparation = { ...created, form: { ...form, sections: [{
    key: 'company', title: '기업 개요', locator: '문단 1', description: '기업을 설명합니다.', status: 'NOT_STARTED', facts: [],
    fields: [{ key: 'name', label: '기업명', guidance: '공식 기업명', required: true }],
  }] } }
  api.get.mockImplementation(async () => structuredClone(current))
  const save = vi.spyOn(api.useCase, 'replaceInputs').mockImplementation(async (_id, _section, input) => {
    current = { ...current, inputRevision: input.expectedRevision + 1, form: { ...current.form,
      sections: current.form.sections.map((section) => ({ ...section, status: 'INPUT_CONFIRMED',
        facts: input.facts.map((fact, index) => ({ ...fact, id: index + 1, inputRevision: input.expectedRevision + 1, updatedAt: created.updatedAt })) })) } }
    return structuredClone(current)
  })
  const file = { id: 81, inputRevision: 1, fileName: '사업계획서_초안.hwpx', mediaType: 'application/hwp+zip', size: 400,
    filledAnswerCount: 1, unfilledAnswerCount: 0, unfilledAnswers: [] }
  const queued: ApplicationDocumentGenerationJob = { id: 501, preparationId: 12, expectedRevision: 1,
    status: 'QUEUED', stage: null, fileIds: [], failureCode: null, failureMessage: null,
    mappingMigration: null, createdAt: created.createdAt, finishedAt: null }
  api.submit.mockResolvedValue(queued)
  const poll = vi.spyOn(api.useCase, 'documentJob').mockImplementation(async () => {
    api.documents.mockResolvedValue([file])
    return { ...queued, status: 'SUCCEEDED', stage: 'SAVING', fileIds: [81], finishedAt: created.updatedAt }
  })
  const download = vi.spyOn(api.useCase, 'downloadDocument').mockResolvedValue(new Blob(['hwpx'], { type: file.mediaType }))
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() }))
  const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe(file.fileName)
  })
  await mount()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '작성 시작' })))
  fireEvent.change(screen.getByRole('textbox', { name: '답변 입력' }), { target: { value: '합성기업' } })
  fireEvent.click(screen.getByRole('button', { name: '다음 →' }))
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(api.submit).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '초안 만들기' })))
  expect(save).toHaveBeenCalledWith(12, 'company', { expectedRevision: 0,
    facts: [{ fieldKey: 'name', status: 'PROVIDED', value: '합성기업', sourceText: '기업명: 합성기업' }] }, expect.any(AbortSignal), undefined)
  expect(api.submit).toHaveBeenCalledExactlyOnceWith(12, 1, expect.any(AbortSignal))
  expect(screen.getByRole('status', { name: '문서 생성 진행' })).toBeTruthy()
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(poll).toHaveBeenCalledOnce()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: `초안 다운로드: ${file.fileName}` })))
  expect(download).toHaveBeenCalledWith(12, 81, expect.any(AbortSignal))
  expect(anchor).toHaveBeenCalledOnce()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '답변 입력으로' })))
  expect((screen.getByRole('textbox', { name: '답변 입력' }) as HTMLTextAreaElement).value).toBe('합성기업')
  expect(screen.getByTestId('location').textContent).toBe('/app/chat')
  expect(api.create).toHaveBeenCalledOnce()
  expect(api.submit).toHaveBeenCalledOnce()
})

it('reopens a saved preparation by ID without creating or generating again', async () => {
  const api = mockPreparation()
  await mount(true, 12)
  expect(screen.getByRole('heading', { name: '답변 입력' })).toBeTruthy()
  expect(api.get).toHaveBeenCalledWith(12, expect.any(AbortSignal))
  expect(api.lookup).not.toHaveBeenCalled()
  expect(api.create).not.toHaveBeenCalled()
  expect(api.discover).not.toHaveBeenCalled()
  expect(api.submit).not.toHaveBeenCalled()
})

it.each(['selection', 'reset', 'account', 'new-card'] as const)('does not attach a late created preparation after %s changes', async (change) => {
  const api = mockPreparation()
  let finish!: (value: ApplicationPreparation) => void
  api.create.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const store = await mount()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '작성 시작' })))
  const signal = api.create.mock.calls[0][1]!
  act(() => {
    if (change === 'selection') store.dispatch(govProgramSelected(null))
    else if (change === 'reset') store.dispatch(conversationReset())
    else if (change === 'new-card') addApplication(store)
    else store.dispatch(signedIn({ ...account, email: 'other@govbiz.local' }))
  })
  expect(signal.aborted).toBe(true)
  await act(async () => finish(created))
  expect(store.getState().chat.messages.some((message) => message.govApplication?.preparationId !== undefined)).toBe(false)
  expect(api.get).not.toHaveBeenCalled()
})

it('retries stored-form lookup and starts paid analysis only on a click, then shows the existing job progress and result', async () => {
  vi.useFakeTimers()
  const api = mockPreparation([])
  api.lookup.mockRejectedValueOnce(new Error('양식 조회 실패'))
  await mount()
  expect(screen.getByText('양식 조회 실패')).toBeTruthy()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '다시 시도' })))
  expect(screen.getByRole('button', { name: '작성 시작' }).hasAttribute('disabled')).toBe(true)
  expect(api.discover).not.toHaveBeenCalled()
  api.discover.mockRejectedValueOnce(new Error('분석 요청 실패')).mockResolvedValue(job('QUEUED'))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '입력칸별로 분석' })))
  expect(screen.getByText('분석 요청 실패')).toBeTruthy()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '입력칸별로 분석' })))
  expect(screen.getByRole('status', { name: '양식 분석 진행' })).toBeTruthy()
  expect(api.discover).toHaveBeenLastCalledWith(program.sourceCode, program.sourceProgramId, expect.any(AbortSignal), expect.any(String))
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(api.poll).toHaveBeenCalledOnce()
  expect(screen.getByRole('heading', { name: '작성할 양식' })).toBeTruthy()
  expect(api.create).not.toHaveBeenCalled()
})

it.each(['selection', 'reset', 'account'] as const)('keeps one live analysis card and aborts late polling on %s change', async (change) => {
  vi.useFakeTimers()
  const api = mockPreparation([])
  api.jobs.mockResolvedValue([job('RUNNING')])
  let finish!: (value: ApplicationFormDiscoveryJob) => void
  api.poll.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const store = await mount()
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  const oldSignal = api.poll.mock.calls[0][1]!
  await act(async () => addApplication(store))
  expect(oldSignal.aborted).toBe(true)
  expect(screen.getAllByRole('status', { name: '양식 분석 진행' })).toHaveLength(1)
  expect(screen.getAllByRole('link', { name: '신청 준비 화면에서 이어서 보기' })).toHaveLength(1)
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(api.poll).toHaveBeenCalledTimes(2)
  const signal = api.poll.mock.calls[1][1]!
  act(() => {
    if (change === 'selection') store.dispatch(govProgramSelected(null))
    else if (change === 'reset') store.dispatch(conversationReset())
    else store.dispatch(signedIn({ ...account, email: 'other@govbiz.local' }))
  })
  expect(signal.aborted).toBe(true)
  await act(async () => { finish(job('SUCCEEDED')); await vi.advanceTimersByTimeAsync(4000) })
  expect(screen.queryByRole('status', { name: '양식 분석 진행' })).toBeNull()
  expect(screen.queryByRole('heading', { name: '작성할 양식' })).toBeNull()
  expect(api.poll).toHaveBeenCalledTimes(2)
  expect(api.discover).not.toHaveBeenCalled()
})

it('keeps the Google Form pathway and its retry without offering paid attachment analysis', async () => {
  const api = mockPreparation([])
  const formUrl = 'https://docs.google.com/forms/d/e/example/viewform'
  api.detail.mockResolvedValue({ ...supportProgramDetails[0], applicationRoute: { type: 'GOOGLE_FORMS', method: '온라인 신청', url: formUrl } })
  vi.spyOn(appContainer.resolve('getMyCompanyUseCase'), 'execute').mockResolvedValue(null)
  const google = vi.spyOn(api.useCase, 'googleForm').mockRejectedValue(new Error('설문을 불러오지 못했어요.'))
  await mount()
  expect(screen.getByRole('heading', { name: '구글 설문으로 신청하는 공고예요' })).toBeTruthy()
  expect(screen.getByRole('link', { name: /구글 설문 열기/ }).getAttribute('href')).toBe(formUrl)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '문항 다시 불러오기' })))
  expect(google).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('button', { name: '입력칸별로 분석' })).toBeNull()
  expect(api.discover).not.toHaveBeenCalled()
  expect(api.create).not.toHaveBeenCalled()
})
