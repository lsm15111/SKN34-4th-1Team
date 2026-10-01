package ai.govbiz.core.applicationpreparation.domain

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

class ApplicationAttachmentRoleTest {
    @ParameterizedTest
    @CsvSource(
        "(서식1)+2026년+스마트공장+사전사후+컨설팅사업+신청서(기업용).hwp, APPLICANT",
        "(서식2)+2026년+스마트공장+사전사후+컨설팅사업+결과보고서(위원용).hwp, NON_APPLICANT",
        "(서식3)+승낙서(위원용).hwp, NON_APPLICANT",
        "(붙임)+2026년+스마트공장+사전사후+컨설팅사업+공고문_.pdf, NON_APPLICANT",
        "2026년 제4회 화성특례시 중소기업대상 제출서식 및 평가표.hwpx, APPLICANT",
        "혁신바우처 사업계획서.hwpx, APPLICANT",
        "붙임2. 심사 평가표.hwpx, NON_APPLICANT",
        "붙임1.hwpx, UNKNOWN",
        "2026 수출바우처 참여기업 모집 안내.pdf, APPLICANT",
    )
    fun classifiesByFileName(fileName: String, expected: ApplicationAttachmentRole) {
        assertEquals(expected, ApplicationAttachmentRole.classify(fileName))
    }

    @Test
    fun formSignalsSeparateFillableFormsFromPlainNotices() {
        assertTrue(ApplicationAttachmentRole.hasFormSignal("[별지 제1호 서식] 참가 신청서"))
        assertTrue(ApplicationAttachmentRole.hasFormSignal("대표자 홍길동 (인)"))
        assertTrue(ApplicationAttachmentRole.hasFormSignal("2026년    월    일"))
        assertTrue(ApplicationAttachmentRole.hasFormSignal("개인정보 수집·이용 동의서"))
        assertFalse(ApplicationAttachmentRole.hasFormSignal("지원 대상: 창업 3년 이내 기업\n신청 기간: 10월 1일까지\n문의처: 02-000-0000"))
        assertTrue(ApplicationAttachmentRole.hasFormSignal("APPLICATION FORM\nCompany name\nSignature"))
    }

    @Test
    fun aNoticeNeedsAStructureSignalNotJustAMentionOfTheForm() {
        val notice = "제출서류: 참가신청서 1부, 사업계획서 1부"
        assertTrue(ApplicationAttachmentRole.hasFormSignal(notice))
        assertFalse(ApplicationAttachmentRole.hasFormSignal(notice, structureOnly = true))
        assertTrue(ApplicationAttachmentRole.hasFormSignal("$notice\n[별지 제1호서식] 참가신청서", structureOnly = true))
    }

    @ParameterizedTest
    @CsvSource(
        "(양식) 산학협력과제 수행 희망서.hwp, true",
        "출품보고서(양식).hwpx, true",
        "테스트 환경 조사서.xlsx, true",
        "Application Form.docx, true",
        "2026 신청내역.xlsx, true",
        "행사 포스터.pdf, false",
        "Platform 소개.pdf, false",
    )
    fun formLikeFileNamesAreAnalyzedEvenWithoutKoreanSignalsInTheText(fileName: String, expected: Boolean) {
        assertEquals(expected, ApplicationAttachmentRole.hasFormName(fileName))
    }

    @Test
    fun printedConsentChecksAreDetected() {
        assertTrue(ApplicationAttachmentRole.hasConsentCheck("개인정보 수집·이용에 동의함 □ 동의하지 않음 □"))
        assertTrue(ApplicationAttachmentRole.hasConsentCheck("□ 동의 □ 미동의"))
        assertTrue(ApplicationAttachmentRole.hasConsentCheck("[  ] 동의함"))
        assertTrue(ApplicationAttachmentRole.hasConsentCheck("동의 여부 : (   )"))
        assertFalse(ApplicationAttachmentRole.hasConsentCheck("참여기업은 협약 내용에 동의한 것으로 봅니다."))
        // 서명으로 갈음하는 문장형 동의는 체크할 칸이 없습니다.
        assertFalse(ApplicationAttachmentRole.hasConsentCheck("위 개인정보 수집·이용에 동의합니다.  신청인 (서명)"))
    }
}
