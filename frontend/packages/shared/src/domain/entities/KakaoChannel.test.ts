import { describe, expect, it } from 'vitest'
import { kakaoChannelChatUrl } from './KakaoChannel'

describe('kakaoChannelChatUrl', () => {
  it('builds the 1:1 chat address from a public channel ID', () => {
    expect(kakaoChannelChatUrl('_AbC123')).toBe('https://pf.kakao.com/_AbC123/chat')
    expect(kakaoChannelChatUrl('  _AbC123 ')).toBe('https://pf.kakao.com/_AbC123/chat')
  })

  it('returns null for missing or malformed IDs so no contact item is shown', () => {
    for (const value of [undefined, '', '   ', 'AbC123', '_', '_a/b', '_a?b=c', 'https://pf.kakao.com/_a/chat']) {
      expect(kakaoChannelChatUrl(value)).toBeNull()
    }
  })
})
