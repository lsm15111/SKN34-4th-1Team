package ai.govbiz.core.supportprogram.domain

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class SupportProgramRegionDictionaryTest {

    @Test
    fun treatsOfficialShortAndCityFormsOfTheSameRegionAsUnchanged() {
        listOf(
            "서울특별시" to "서울",
            "서울시 강남구" to "서울 강남구",
            "서울특별시 강남구" to "서울 강남",
            "강원도" to "강원특별자치도",
            "전라북도" to "전북",
            "경기도  성남시" to "경기 성남시",
            "서울 지역" to "서울특별시",
            "광주특별시" to "전남광주통합특별시",
            "ＳＥＯＵＬ" to "SEOUL",
        ).forEach { (left, right) ->
            assertTrue(SupportProgramRegionDictionary.isSameRegion(left, right), "$left = $right")
            assertTrue(SupportProgramRegionDictionary.isSameRegion(right, left), "$right = $left")
        }
    }

    @Test
    fun keepsMoreSpecificAmbiguousOrDifferentRegionsAsRealChanges() {
        listOf(
            "서울" to "서울 강남구",
            "서울" to "부산",
            // 경기 광주시와 광주광역시를 같은 지역으로 추정하지 않습니다.
            "광주시" to "광주광역시",
            "광주광역시" to "광주특별시",
            "서울" to null,
            null to null,
            "" to "",
            "지역" to "지역",
        ).forEach { (left, right) ->
            assertFalse(SupportProgramRegionDictionary.isSameRegion(left, right), "$left != $right")
        }
    }

    @Test
    fun resolvesProvincesAreasAndDistrictsIncludingTheOctober2026AdministrativeMap() {
        mapOf(
            "서울특별시" to setOf("서울"),
            "경기도 성남시 분당구" to setOf("경기"),
            "분당구" to setOf("경기"),
            "분당" to setOf("경기"),
            "강남" to setOf("서울"),
            "해운대구" to setOf("부산"),
            "서울 강서구" to setOf("서울"),
            "세종시" to setOf("세종"),
            "제주시" to setOf("제주"),
            "수도권" to setOf("서울", "인천", "경기"),
            "동남권" to setOf("부산", "울산", "경남"),
            // 2026-07-01 인천 행정체제 개편과 2026-02-01 화성 일반구, 2023-07-01 군위군 편입입니다.
            "제물포구" to setOf("인천"),
            "영종구" to setOf("인천"),
            "서해구" to setOf("인천"),
            "검단구" to setOf("인천"),
            "동탄구" to setOf("경기"),
            "군위군" to setOf("대구"),
            // 2026-07-01 전남광주통합특별시는 공고 태그의 광주·전남을 함께 뜻합니다.
            "전남광주통합특별시 순천시" to setOf("광주", "전남"),
            "광주특별시" to setOf("광주", "전남"),
            "광주" to setOf("광주"),
        ).forEach { (region, expected) ->
            assertEquals(expected, SupportProgramRegionDictionary.provincesOf(region), region)
        }
    }

    @Test
    fun returnsEveryCandidateForAmbiguousDistrictsAndNothingForUnknownOrNationwideText() {
        assertEquals(setOf("서울", "부산"), SupportProgramRegionDictionary.provincesOf("강서구"))
        assertEquals(setOf("강원", "경남"), SupportProgramRegionDictionary.provincesOf("고성군"))
        assertEquals(setOf("광주", "경기"), SupportProgramRegionDictionary.provincesOf("광주시"))
        // 인천 중구는 2026-07-01 제물포구·영종구로 재편되어 더 이상 후보가 아닙니다.
        assertEquals(setOf("서울", "부산", "대구", "대전", "울산"), SupportProgramRegionDictionary.provincesOf("중구"))
        assertTrue("경북" in SupportProgramRegionDictionary.provincesOf("남구"))
        listOf(null, "", "  ", "전국", "판교", "해외", "중").forEach {
            assertEquals(emptySet<String>(), SupportProgramRegionDictionary.provincesOf(it), "$it")
        }
    }

    @Test
    fun flagsOnlyTagsThatAreNotNationwideAndDoNotOverlapTheCompanyRegion() {
        assertTrue(SupportProgramRegionDictionary.isOutsideTaggedRegions("서울특별시", listOf("경북")))
        assertTrue(SupportProgramRegionDictionary.isOutsideTaggedRegions("서울 강남구", listOf("경북", "전남")))
        assertTrue(SupportProgramRegionDictionary.isOutsideTaggedRegions("수도권", listOf("부산")))
        assertTrue(SupportProgramRegionDictionary.isOutsideTaggedRegions("강서구", listOf("경북")))

        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("서울", listOf("서울")))
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("서울", listOf("경북", "서울")))
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("서울", listOf("전국")))
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("서울", listOf("경북", "전국")))
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("서울", emptyList()))
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("서울", listOf("해외")))
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("수도권", listOf("경기")))
        // 해석할 수 없는 회사 지역은 다른 지역이라고 추정하지 않습니다.
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("판교", listOf("경북")))
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions(null, listOf("경북")))
        // 같은 이름의 구는 가능한 시·도 중 하나라도 겹치면 다른 지역으로 보지 않습니다.
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("강서구", listOf("부산")))
        // 광주·전남은 2026-07-01 통합특별시로 같은 지역입니다.
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("광주광역시", listOf("전남")))
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("광산구", listOf("전남")))
        assertFalse(SupportProgramRegionDictionary.isOutsideTaggedRegions("순천시", listOf("광주")))
    }
}
