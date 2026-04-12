/**
 * Web Speech API wrapper for voice input.
 * Uses browser-native SpeechRecognition (no external deps).
 */

export interface SpeechOptions {
  lang?: string
  onResult: (transcript: string) => void
  onEnd?: () => void
  onError?: (error: string) => void
}

export function startSpeechRecognition(options: SpeechOptions): (() => void) | null {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  if (!SpeechRecognition) {
    options.onError?.("此瀏覽器不支援語音輸入")
    return null
  }

  const recognition = new SpeechRecognition()
  recognition.lang = options.lang || "zh-TW"
  recognition.interimResults = true
  recognition.continuous = true

  recognition.onresult = (event: any) => {
    let transcript = ""
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript
    }
    options.onResult(transcript)
  }

  recognition.onerror = (event: any) => {
    options.onError?.(event.error)
  }

  recognition.onend = () => {
    options.onEnd?.()
  }

  recognition.start()

  // Return stop function
  return () => {
    recognition.stop()
  }
}

export function isSpeechSupported(): boolean {
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  )
}
