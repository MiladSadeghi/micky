export type TextDirection = 'rtl' | 'ltr'

const STRONG_RTL = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}]/u
const STRONG_LTR =
  /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u

export function detectTextDirection(text: string, fallback: TextDirection = 'rtl'): TextDirection {
  for (const char of text) {
    if (STRONG_RTL.test(char)) return 'rtl'
    if (STRONG_LTR.test(char)) return 'ltr'
  }
  return fallback
}
