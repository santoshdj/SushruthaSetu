import { useEffect, useRef, useState } from 'react'

interface SpeechRecognitionHook {
  isListening: boolean
  isSupported: boolean
  start: () => void
  stop: () => void
}

// Broaden the window type for cross-browser SpeechRecognition
const SpeechRecognitionAPI =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

/**
 * Wraps the Web Speech API SpeechRecognition.
 * Streams live transcription into a textarea via a setter callback.
 *
 * @param onResult  Called with each finalised word chunk to append to the note.
 * @param onInterim Called with the current interim (not-yet-final) text for live preview.
 */
export function useSpeechRecognition(
  onResult: (text: string) => void,
  onInterim: (text: string) => void,
): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  const isSupported = !!SpeechRecognitionAPI

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const start = () => {
    if (!isSupported || isListening) return
    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          onResult(result[0].transcript)
        } else {
          interim += result[0].transcript
        }
      }
      onInterim(interim)
    }

    recognition.onend = () => {
      setIsListening(false)
      onInterim('')
    }

    recognition.onerror = (event: any) => {
      console.error('[SpeechRecognition] error:', event.error)
      setIsListening(false)
      onInterim('')
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const stop = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
    onInterim('')
  }

  return { isListening, isSupported, start, stop }
}
