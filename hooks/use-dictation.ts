"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Dictation through the browser speech recogniser.
 *
 * The recogniser transcribes in a chosen BCP-47 tag; the engine then detects
 * the language of the transcript on its own, so the reply is written in the
 * language the customer actually used.
 */

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export type DictationStatus =
  | "idle"
  | "listening"
  | "unsupported"
  | "denied"
  | "error"
  | "empty";

export type Dictation = {
  status: DictationStatus;
  /** The transcript as it is being spoken. */
  interim: string;
  supported: boolean;
  start: () => void;
  stop: () => void;
};

export function useDictation(options: {
  /** BCP-47 tag for the recogniser. */
  language: string;
  onFinal: (transcript: string) => void;
}): Dictation {
  const { language, onFinal } = options;
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef<string>("");
  const supported = useSyncExternalStore(
    () => () => {},
    () => getRecognitionCtor() !== null,
    () => false,
  );
  const onFinalRef = useRef(onFinal);
  // Keep the latest callback without writing a ref during render.
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);
  const detach = useCallback(() => {
    const current = recognitionRef.current;
    recognitionRef.current = null;
    if (current) {
      current.onresult = null;
      current.onend = null;
      current.onerror = null;
      current.abort();
    }
    finalRef.current = "";
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    detach();
    const recognition = new Ctor();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    finalRef.current = "";

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalRef.current += text;
        else live += text;
      }
      setInterim(live);
    };
    recognition.onerror = (event) => {
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      )
        setStatus("denied");
      else if (event.error === "no-speech") setStatus("empty");
      else setStatus("error");
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      const transcript = finalRef.current.trim();
      recognitionRef.current = null;
      setInterim("");
      if (transcript) {
        setStatus("idle");
        onFinalRef.current(transcript);
        return;
      }
      setStatus((current) => (current === "listening" ? "empty" : current));
    };

    recognitionRef.current = recognition;
    setStatus("listening");
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setStatus("error");
    }
  }, [language, detach]);

  // Restart on a language change so the next utterance uses the new tag.
  // Visible state is reset during render (React's pattern for prop-driven
  // resets); the effect only releases the recognizer.
  const [activeLanguage, setActiveLanguage] = useState(language);
  if (activeLanguage !== language) {
    setActiveLanguage(language);
    setStatus("idle");
    setInterim("");
  }
  useEffect(() => {
    detach();
  }, [language, detach]);

  useEffect(
    () => () => {
      detach();
    },
    [detach],
  );

  return { status, interim, supported, start, stop };
}
