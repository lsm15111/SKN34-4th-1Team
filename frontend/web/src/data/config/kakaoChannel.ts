import { kakaoChannelChatUrl as channelChatUrl } from '@govbiz/shared/domain/entities/KakaoChannel'

/**
 * 도우미의 담당자 문의 버튼이 여는 카카오톡 채널 1:1 채팅 주소입니다.
 * `VITE_KAKAO_CHANNEL_ID`가 비어 있거나 형식이 맞지 않으면 null이며, 그때는 문의 버튼을 두지 않습니다.
 * 환경값 읽기는 `coreApiConfig`처럼 data 계층에 두고, 화면은 DI로 받은 함수만 부릅니다.
 */
export function kakaoChannelChatUrl(): string | null {
  return channelChatUrl(import.meta.env.VITE_KAKAO_CHANNEL_ID)
}

export type KakaoChannelChatUrl = typeof kakaoChannelChatUrl
