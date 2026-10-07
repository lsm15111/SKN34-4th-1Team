import type { GettingStartedRepository } from '../repositories/GettingStartedRepository'

/** 본인 시작하기 안내를 읽고, [닫기]와 [시작하기 다시 보기]를 저장합니다. 단계 완료는 서버가 기존 기록으로 정합니다. */
export class GettingStartedUseCase {
  private readonly repository: GettingStartedRepository
  constructor(repository: GettingStartedRepository) { this.repository = repository }
  guide(signal?: AbortSignal) { return this.repository.guide(signal) }
  close(signal?: AbortSignal) { return this.repository.setClosed(true, signal) }
  reopen(signal?: AbortSignal) { return this.repository.setClosed(false, signal) }
}
