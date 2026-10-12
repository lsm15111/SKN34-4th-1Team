/** 카카오톡 채널 공개 ID는 `_`로 시작하는 영문·숫자입니다. 다른 값은 주소에 넣지 않습니다. */
const CHANNEL_PUBLIC_ID = /^_[A-Za-z0-9]+$/

/**
 * 도우미의 담당자 문의가 여는 카카오톡 채널 1:1 채팅 주소입니다.
 * 웹은 `VITE_KAKAO_CHANNEL_ID`, 앱은 `EXPO_PUBLIC_KAKAO_CHANNEL_ID`를 넘깁니다.
 * 비어 있거나 형식이 맞지 않으면 null이며, 그때는 문의 항목을 두지 않습니다.
 */
export function kakaoChannelChatUrl(channelId: string | undefined): string | null {
  const id = channelId?.trim() ?? ''
  return CHANNEL_PUBLIC_ID.test(id) ? `https://pf.kakao.com/${id}/chat` : null
}
