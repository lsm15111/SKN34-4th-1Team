package ai.govbiz.core.applicationpreparation.service.exception

/**
 * 계정의 진행 중인 문서 생성 작업이 요금제의 동시 처리 한도([limit]건)에 이미 닿았습니다. 작업이 끝나면 같은 요청이 받아들여지므로
 * 입력 오류(422)가 아니라 다른 동시 처리 한도와 같은 429로 응답합니다.
 */
class ApplicationDocumentJobCapacityException(val limit: Int) :
    RuntimeException("진행 중인 문서 생성이 이미 ${limit}건입니다. 끝난 뒤 다시 시도해 주세요.")
