import type { GovAgentProgram } from '@govbiz/shared/domain/entities/GovAgent'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { appPaths } from '../../../shared/routes/appPaths'
import { WorkspaceToast } from '../../../shared/workspace/WorkspaceToast'
import { useApplicationPreparationNewViewModel } from '../viewmodel/useApplicationPreparationNewViewModel'
import { newPreparationStyles as n } from './ApplicationPreparation.styles'
import { ApplicationPreparationStartAction, FormSectionBody } from './ApplicationPreparationNewPage'
import { ApplicationPreparationEditorPanel } from './ApplicationPreparationPages'
import { ApplicationDocumentPanel } from './ApplicationDocumentPage'

/** 대화 기록에는 준비 건 ID만 보관하고, 답변과 문서는 기존 API에서 다시 읽습니다. */
export function ApplicationPreparationInline({ program, preparationId, onPrepared }: {
  program: GovAgentProgram
  preparationId?: number
  onPrepared: (id: number) => void
}) {
  const [documents, setDocuments] = useState<{ revision?: number } | null>(null)
  if (preparationId === undefined) return <ApplicationPreparationStart program={program} onPrepared={onPrepared} />
  return <section className="mt-3 flex flex-col gap-4" aria-label={`신청 준비 · ${program.title}`}>
    {documents === null
      ? <ApplicationPreparationEditorPanel id={preparationId} program={program} onDocuments={(revision) => setDocuments({ revision })} />
      : <ApplicationDocumentPanel key={`${preparationId}:${documents.revision ?? 'saved'}`} id={preparationId}
        program={program} requestedRevision={documents.revision} onEdit={() => setDocuments(null)} />}
    <Link className={n.ghost} to={`${appPaths.applicationPreparations}/${preparationId}`}>신청 준비 화면에서 열기</Link>
  </section>
}

function ApplicationPreparationStart({ program, onPrepared }: { program: GovAgentProgram; onPrepared: (id: number) => void }) {
  const vm = useApplicationPreparationNewViewModel(program.sourceCode, program.sourceProgramId, (created) => onPrepared(created.id))
  const headingId = useId()
  const path = `${appPaths.applicationPreparationNew}?${new URLSearchParams({ sourceCode: program.sourceCode, sourceProgramId: program.sourceProgramId })}`
  return <section className="mt-3 flex flex-col gap-4" aria-labelledby={headingId}>
    <h2 className={n.sectionTitle} id={headingId}>신청 준비 · {program.title}</h2>
    <p className={n.muted}>저장된 양식을 확인하고 작성할 양식과 분야를 골라 주세요. 입력칸별 AI 분석은 버튼을 눌러 시작합니다.</p>
    {vm.programLoad.status === 'loading' && <p role="status" className={n.muted}>공고를 불러오는 중입니다.</p>}
    {vm.programLoad.status === 'failed' && <div role="alert" className={`${n.alert} ${n.alertDanger}`}>
      <p>{vm.programLoad.error.message}</p>
      <button type="button" className={n.secondarySm} onClick={vm.retryProgramLoad}>다시 시도</button>
    </div>}
    {vm.program && <>
      <FormSectionBody vm={vm} />
      <ApplicationPreparationStartAction vm={vm}>
        <Link className={n.ghost} to={path}>신청 준비 화면에서 열기</Link>
      </ApplicationPreparationStartAction>
    </>}
    <WorkspaceToast notice={vm.toast} onClose={vm.dismissToast} />
  </section>
}
