import type { GettingStartedRepository } from '@govbiz/shared/domain/repositories/GettingStartedRepository'
import { gettingStartedRequest } from '../api/gettingStartedApi'

export class GettingStartedRepositoryImpl implements GettingStartedRepository {
  guide(signal?: AbortSignal) { return gettingStartedRequest('GET', undefined, signal) }
  setClosed(closed: boolean, signal?: AbortSignal) { return gettingStartedRequest('PUT', { closed }, signal) }
}
