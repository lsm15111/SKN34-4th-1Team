import { Fragment } from 'react'
import { Link } from 'react-router'

import { appPaths, publicPaths } from '../../../shared/routes/appPaths'

import { pricingPageStyles } from './PricingPage.styles'

// 지금은 모든 회원이 무료 요금제이고, 플러스·프리미엄은 출시 예정입니다. 한도 숫자는 Core `PlanCode`와 같아야 합니다.
// 가격은 부가세 포함 예정가이며, 결제·구독은 받지 않습니다.
const plans = [
  {
    id: 'free',
    label: 'FREE',
    name: '무료',
    status: '지금 이용 가능',
    description: '우리 기업에 맞는 지원사업을 찾고, 공고의 조건부터 확인하고 싶다면.',
    price: '0원',
    priceNote: '회원가입 후 바로 이용 · 로그인 전에는 AI 대화 검색 하루 3회 체험',
    featureHeading: '이용 한도',
    features: [
      'AI 대화 검색 하루 10회',
      '공고 원문 질문 하루 10회',
      '신청 문서 초안 월 1건 · 중복 검토 월 2회',
      '필터 검색·공고 상세·첨부 받기는 횟수 제한 없음',
    ],
    footerNote: '하루 한도는 자정, 월 한도는 매월 1일 0시(서울 시간)에 다시 채워집니다.',
    action: 'search',
    isAvailable: true,
    isFeatured: true,
  },
  {
    id: 'plus',
    label: 'PLUS',
    name: '플러스',
    status: '출시 예정',
    description: '여러 공고를 동시에 준비하며 맞춤 리포트·중복 검토·신청 문서를 자주 쓰고 싶다면.',
    price: '월 9,900원',
    priceNote: '부가세 포함 · 공급가액 9,000원 · 연간 결제 시 연 99,000원(2개월 무료)',
    featureHeading: '이용 한도(예정)',
    features: [
      'AI 대화 검색 하루 40회',
      '공고 원문 질문 하루 50회',
      '신청 문서 초안 월 5건 · 중복 검토 월 20회',
    ],
    footerNote: '결제는 아직 받지 않습니다. 출시 전에 가격과 결제 방법을 안내하고 동의를 받습니다.',
    action: 'pending',
    isAvailable: false,
    isFeatured: false,
  },
  {
    id: 'premium',
    label: 'PREMIUM',
    name: '프리미엄',
    status: '출시 예정',
    description: '신청서 초안까지 AI가 먼저 채우고, 검색과 해석을 더 빠르게 받고 싶다면.',
    price: '월 29,000원',
    priceNote: '부가세 포함 · 공급가액 26,364원 · 연간 결제 시 연 290,000원(2개월 무료)',
    featureHeading: '이용 한도(예정)',
    features: [
      'AI 대화 검색 하루 150회',
      '공고 원문 질문 하루 200회',
      '신청 문서 초안 월 30건 · 중복 검토 월 100회',
      '신청서 항목별 AI 초안 자동 채움과 검색·조건 해석 우선 처리(준비 중)',
    ],
    footerNote: '가격과 제공 범위는 출시 시 다시 안내합니다.',
    action: 'pending',
    isAvailable: false,
    isFeatured: false,
  },
] as const

/** 요금제별 이용 한도 비교표입니다. 숫자는 서버가 실제로 세는 한도와 같고, 무제한 대신 숫자로 적습니다. */
const limitRows = [
  { feature: 'AI 대화 검색', note: '검색 실행 기준', guest: '하루 3회 · 결과 2건', free: '하루 10회', plus: '하루 40회', premium: '하루 150회' },
  { feature: '공고 원문 질문', note: '', guest: '로그인 필요', free: '하루 10회', plus: '하루 50회', premium: '하루 200회' },
  { feature: '신청 문서 초안', note: '공고 하나를 한 건으로', guest: '로그인 필요', free: '월 1건', plus: '월 5건', premium: '월 30건' },
  { feature: '중복 지원·수혜 검토', note: '진행 중인 검토 포함', guest: '로그인 필요', free: '월 2회', plus: '월 20회', premium: '월 100회' },
  { feature: '도우미에게 직접 질문', note: '', guest: '로그인 필요', free: '이용 가능', plus: '이용 가능', premium: '이용 가능' },
  { feature: '필터 검색 · 공고 상세 · 첨부 받기', note: '', guest: '횟수 제한 없음', free: '횟수 제한 없음', plus: '횟수 제한 없음', premium: '횟수 제한 없음' },
] as const

const searchSteps = [
  {
    number: '01',
    title: '필요한 지원사업 찾기',
    description: '지역, 업종, 지원 목적을 자연스럽게 입력하고 관련 공고를 찾아보세요.',
  },
  {
    number: '02',
    title: '기업 조건과 비교하기',
    description: '입력한 조건을 바탕으로 공고의 자격 조건과 추가 확인이 필요한 부분을 살펴보세요.',
  },
  {
    number: '03',
    title: '원문을 근거로 질문하기',
    description: '기업마당 공고 상세에서 궁금한 내용을 질문하고, 답변의 근거를 원문과 함께 확인하세요.',
  },
] as const

const frequentlyAskedQuestions = [
  {
    question: '무료 요금제에서는 무엇을 할 수 있나요?',
    answer: '로그인하면 AI 대화 검색 하루 10회, 공고 원문 질문 하루 10회, 신청 문서 초안 월 1건, 중복 지원·수혜 검토 월 2회를 이용할 수 있습니다. 필터 검색·공고 상세·첨부 받기는 횟수 제한이 없습니다. 로그인 전에는 AI 대화 검색을 하루 3회까지 체험할 수 있고 결과는 2건까지 보입니다. 원문 질문과 도우미 질문은 로그인 후 이용할 수 있습니다.',
  },
  {
    question: '한도는 어떻게 세고 언제 다시 채워지나요?',
    answer: '하루 한도는 매일 자정, 월 한도는 매월 1일 0시(서울 시간)에 다시 채워집니다. 실패한 검색·질문과 실패로 끝난 분석은 횟수에서 빠집니다. 신청 문서 초안은 공고 하나를 한 건으로 세므로 같은 공고의 양식 분석과 문서 생성을 다시 해도 늘지 않고, 중복 검토는 진행 중인 검토도 횟수에 들어갑니다. 남은 횟수는 내 정보 화면에서 확인할 수 있습니다.',
  },
  {
    question: '플러스와 프리미엄은 지금 신청할 수 있나요?',
    answer: '아직 신청할 수 없습니다. 지금은 모든 회원이 무료 요금제로 이용하며 결제나 구독 신청을 받지 않습니다. 표시한 가격은 부가세를 포함한 예정가이고, 유료 요금제를 시작할 때는 가격과 결제 방법을 미리 알리고 따로 동의를 받습니다.',
  },
  {
    question: 'AI가 지원 자격이나 선정을 보장하나요?',
    answer: '아니요. AI의 조건 확인과 답변은 공고를 살펴보기 위한 참고 정보입니다. 조건 확인은 공식 API 본문을 기준으로 하며 첨부파일은 검증하지 않으므로, 지원 자격·접수 상태·신청 방법은 공고 원문과 담당 기관에서 최종 확인해야 합니다.',
  },
  {
    question: '공고 출처는 어디인가요?',
    answer: '기업마당, K-Startup, 과학기술정보통신부, 충청남도 온라인수출지원시스템의 공식 API에서 공고를 받아 주기적으로 갱신합니다. 각 공고에는 원문 보기 링크가 있어 상세 조건과 첨부파일을 제공 기관 페이지에서 바로 확인할 수 있습니다.',
  },
  {
    question: '기업 정보는 저장되나요? 계정을 삭제하면 어떻게 되나요?',
    answer: '기업 프로필은 계정에 저장됩니다. 계정을 삭제하면 기업 프로필·대화 기록·로그인 정보가 지워지며, 진행 중이던 모집글은 마감되고 보낸 제안은 철회됩니다.',
  },
  {
    question: '파트너 모집글은 누가 올릴 수 있나요?',
    answer: '이메일 인증과 사업자 상태 확인을 마친 기업 등록 회원만 모집글을 올리고 제안을 보낼 수 있습니다. 회원은 모집글과 상세를 읽을 수 있고, 로그인 전에는 공개 목록만 볼 수 있습니다.',
  },
] as const

type PricingPageLayout = 'public' | 'workspace'

const pricingTitle = '기업의 다음 단계에 맞는 요금제'

/** 글자 공간과 접근 가능한 제목은 유지하고 시각적인 글자만 순서대로 나타냅니다. */
function PricingTitle() {
  let characterIndex = 0
  return <h1 className={pricingPageStyles.title} id="pricing-title" aria-label={pricingTitle}>
    <span aria-hidden="true">
      {pricingTitle.split(' ').map((word, wordIndex) => {
        if (wordIndex > 0) characterIndex += 1
        return <Fragment key={wordIndex}>
          {wordIndex > 0 ? ' ' : null}
          <span className={pricingPageStyles.titleWord}>
            {Array.from(word).map((character, index) => <span key={index} data-pricing-title-character=""
              className={pricingPageStyles.titleCharacter}
              style={{ animationDelay: `${180 + characterIndex++ * 75}ms` }}>{character}</span>)}
          </span>
        </Fragment>
      })}
    </span>
  </h1>
}

/**
 * 결제 기능 없이 현재 공개 기능과 출시 예정 요금제를 안내합니다. 로그인 전에는 헤더 아래 공개 페이지로,
 * 로그인 뒤에는 사이드바 안에서 같은 내용을 보여 주며 검색 진입 버튼만 각 세계의 검색 화면으로 향합니다.
 */
export function PricingPage({ layout = 'public' }: { layout?: PricingPageLayout }) {
  const searchPath = layout === 'workspace' ? appPaths.chat : publicPaths.landing
  return (
    <main className={pricingPageStyles.page}>
      <section className={pricingPageStyles.hero} aria-labelledby="pricing-title">
        <PricingTitle />
        <p className={pricingPageStyles.description}>
          지원사업 탐색부터 신청 준비까지 지금 무료로 시작하세요.
          <br />
          신청서 AI 초안과 우선 처리는 프리미엄으로 준비하고 있습니다.
        </p>
      </section>

      <section className={pricingPageStyles.plansSection} aria-labelledby="pricing-plans-title">
        <h2 className={pricingPageStyles.plansHeading} id="pricing-plans-title">
          지금 시작하고, 필요한 만큼 확장하세요
        </h2>
        <div className={pricingPageStyles.plansGrid}>
          {plans.map((plan) => {
            const cardTone = plan.isFeatured
              ? pricingPageStyles.featuredCard
              : pricingPageStyles.regularCard
            const mutedTone = plan.isFeatured
              ? pricingPageStyles.featuredMuted
              : pricingPageStyles.regularMuted
            const iconTone = plan.isFeatured
              ? pricingPageStyles.featuredIcon
              : pricingPageStyles.regularIcon

            return (
              <article
                className={`${pricingPageStyles.planCard} ${cardTone}`}
                aria-labelledby={`pricing-${plan.id}-title`}
                key={plan.id}
              >
                <div className={pricingPageStyles.planTop}>
                  <p className={`${pricingPageStyles.planEyebrow} ${mutedTone}`}>{plan.label}</p>
                  <span className={`${pricingPageStyles.planStatus} ${plan.isFeatured
                    ? pricingPageStyles.featuredStatus
                    : pricingPageStyles.regularStatus}`}
                  >
                    {plan.status}
                  </span>
                </div>
                <h3 className={pricingPageStyles.planTitle} id={`pricing-${plan.id}-title`}>
                  {plan.name}
                </h3>
                <p className={`${pricingPageStyles.planDescription} ${mutedTone}`}>
                  {plan.description}
                </p>
                <div className={pricingPageStyles.priceBlock}>
                  <p className={pricingPageStyles.price}>
                    {plan.price}
                  </p>
                  <p className={`${pricingPageStyles.priceNote} ${mutedTone}`}>{plan.priceNote}</p>
                </div>
                <div className={`${pricingPageStyles.divider} ${plan.isFeatured
                  ? pricingPageStyles.featuredDivider
                  : pricingPageStyles.regularDivider}`}
                  aria-hidden="true"
                />
                <p className={pricingPageStyles.featureHeading}>{plan.featureHeading}</p>
                <ul className={pricingPageStyles.featureList}>
                  {plan.features.map((feature) => (
                    <li className={pricingPageStyles.featureItem} key={feature}>
                      <svg
                        className={`${pricingPageStyles.featureIcon} ${iconTone}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d={plan.isAvailable ? 'm5 12 4 4L19 6' : 'M12 5v14M5 12h14'} />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className={pricingPageStyles.planFooter}>
                  {plan.action === 'search' ? (
                    <Link className={`${pricingPageStyles.planButton} ${pricingPageStyles.availableButton}`} to={searchPath}>
                      무료로 지원사업 찾기
                    </Link>
                  ) : (
                    <button
                      className={`${pricingPageStyles.planButton} ${plan.isFeatured
                        ? pricingPageStyles.featuredPendingButton
                        : pricingPageStyles.regularPendingButton}`}
                      type="button"
                      disabled
                    >
                      출시 준비 중
                    </button>
                  )}
                  <p className={`${pricingPageStyles.footerNote} ${mutedTone}`}>{plan.footerNote}</p>
                </div>
              </article>
            )
          })}
        </div>
        <p className={pricingPageStyles.releaseNote}>
          표시한 가격은 부가세를 포함한 예정가입니다. 지금은 모든 회원이 무료 요금제로 이용하며 결제·구독은 받지 않습니다.
          유료 요금제를 시작할 때는 가격과 결제 방법을 미리 알리고 따로 동의를 받습니다.
        </p>
      </section>

      <section className={pricingPageStyles.limitsSection} aria-labelledby="pricing-limits-title">
        <div className={pricingPageStyles.faqHeader}>
          <h2 className={pricingPageStyles.sectionHeading} id="pricing-limits-title">요금제별 이용 한도</h2>
          <p className={pricingPageStyles.faqDescription}>
            AI를 쓰는 기능만 횟수를 셉니다. 실패한 요청과 분석은 횟수에서 빠집니다.
          </p>
        </div>
        <div className={pricingPageStyles.limitsTableWrap}>
          <table className={pricingPageStyles.limitsTable}>
            <caption className="sr-only">로그인 전과 요금제별 기능 이용 한도</caption>
            <thead>
              <tr>
                <th scope="col" className={pricingPageStyles.limitsHeadCell}>기능</th>
                <th scope="col" className={pricingPageStyles.limitsHeadCell}>로그인 전</th>
                <th scope="col" className={pricingPageStyles.limitsHeadCell}>무료</th>
                <th scope="col" className={pricingPageStyles.limitsHeadCell}>플러스(예정)</th>
                <th scope="col" className={pricingPageStyles.limitsHeadCell}>프리미엄(예정)</th>
              </tr>
            </thead>
            <tbody>
              {limitRows.map((row) => (
                <tr key={row.feature}>
                  <th scope="row" className={pricingPageStyles.limitsFeatureCell}>
                    {row.feature}
                    {row.note ? <span className={pricingPageStyles.limitsNote}>{row.note}</span> : null}
                  </th>
                  <td className={pricingPageStyles.limitsCell}>{row.guest}</td>
                  <td className={pricingPageStyles.limitsCell}>{row.free}</td>
                  <td className={pricingPageStyles.limitsCell}>{row.plus}</td>
                  <td className={pricingPageStyles.limitsCell}>{row.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={pricingPageStyles.valueSection} aria-labelledby="pricing-value-title">
        <div>
          <p className={pricingPageStyles.sectionEyebrow}>현재 무료로 이용할 수 있어요</p>
          <h2 className={pricingPageStyles.sectionHeading} id="pricing-value-title">
            찾고, 확인하고, 질문하세요
          </h2>
        </div>
        <div className={pricingPageStyles.valueGrid}>
          {searchSteps.map((step) => (
            <div className={pricingPageStyles.valueItem} key={step.number}>
              <span className={pricingPageStyles.valueNumber} aria-hidden="true">{step.number}</span>
              <h3 className={pricingPageStyles.valueTitle}>{step.title}</h3>
              <p className={pricingPageStyles.valueDescription}>{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={pricingPageStyles.faqSection} aria-labelledby="pricing-faq-title">
        <div className={pricingPageStyles.faqHeader}>
          <h2 className={pricingPageStyles.sectionHeading} id="pricing-faq-title">자주 묻는 질문</h2>
          <p className={pricingPageStyles.faqDescription}>이용 전에 궁금한 점을 확인하세요.</p>
        </div>
        <div className={pricingPageStyles.faqList}>
          {frequentlyAskedQuestions.map((faq) => (
            <details className={pricingPageStyles.faqItem} key={faq.question}>
              <summary className={pricingPageStyles.faqQuestion}>
                <span className={pricingPageStyles.faqQuestionText}>{faq.question}</span>
                <svg
                  className={pricingPageStyles.faqIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className={pricingPageStyles.faqAnswer}>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={pricingPageStyles.closingSection} aria-labelledby="pricing-start-title">
        <h2 className={pricingPageStyles.sectionHeading} id="pricing-start-title">
          다음 기회가 될 공고를 만나보세요
        </h2>
        <p className={pricingPageStyles.closingDescription}>
          우리 기업의 지역, 업종, 지원 목적부터 이야기해 주세요.
          <br />
          지금 제공하는 검색 기능으로 탐색을 시작할 수 있습니다.
        </p>
        <Link className={pricingPageStyles.closingButton} to={searchPath}>
          지원사업 찾기 시작하기
          <svg
            className={pricingPageStyles.arrowIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </Link>
      </section>
    </main>
  )
}
