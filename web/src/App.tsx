import { useEffect, useMemo, useRef, useState } from "react";

type Mode = "walkie" | "split";
type Direction = "zh_to_es" | "es_to_zh";
type Side = "top" | "bottom";
type PanelKey = "walkie" | Side;
type PanelPhase = "idle" | "recording" | "processing" | "ready" | "error";

type TurnResponse = {
  transcript: string;
  translation: string;
  output_language: string;
  audio_base64?: string | null;
  audio_content_type?: string | null;
};

type PanelState = {
  phase: PanelPhase;
  transcript: string;
  translation: string;
  error: string | null;
  audioUrl: string | null;
};

type CaptureTarget = {
  key: PanelKey;
  direction: Direction;
};

const INITIAL_PANEL: PanelState = {
  phase: "idle",
  transcript: "",
  translation: "",
  error: null,
  audioUrl: null,
};

type DirectionCopy = {
  heroTitle: string;
  heroHintIdle: string;
  heroHintRecording: string;
  heroHintProcessing: string;
  statusIdle: string;
  statusRecording: string;
  statusProcessing: string;
  statusReady: string;
  statusError: string;
  transcriptLabel: string;
  transcriptEmpty: string;
  translationLabel: string;
  translationEmpty: string;
  recordLabelIdle: string;
  recordLabelRecording: string;
  recordLabelProcessing: string;
  playLabel: string;
  playingLabel: string;
  splitTitle: string;
  splitSubtitle: string;
};

function walkieTranscriptLabel(direction: Direction): string {
  return "Transcripción · 转录";
}

function walkieTranslationLabel(direction: Direction): string {
  return "Traducción · 翻译";
}

function walkieTranscriptEmpty(direction: Direction): string {
  return "Aquí aparecerá el texto transcrito.\n这里会显示转录文本。";
}

function walkieTranslationEmpty(direction: Direction): string {
  return "Aquí aparecerá el texto traducido.\n这里会显示翻译文本。";
}

function splitGenericTranscriptLabel(direction: Direction): string {
  return direction === "zh_to_es" ? "转录" : "Transcripción";
}

function splitGenericTranslationLabel(direction: Direction): string {
  return direction === "zh_to_es" ? "Traducción" : "翻译";
}

function directionCopy(direction: Direction): DirectionCopy {
  if (direction === "zh_to_es") {
    return {
      heroTitle: "请讲中文",
      heroHintIdle: "按一次开始说话，再按一次停止并翻译。",
      heroHintRecording: "再按一次即可停止并翻译。",
      heroHintProcessing: "正在处理语音、文字和翻译。",
      statusIdle: "等待中",
      statusRecording: "正在听",
      statusProcessing: "翻译中",
      statusReady: "已完成",
      statusError: "错误",
      transcriptLabel: "识别到的中文",
      transcriptEmpty: "这里会显示识别到的中文。",
      translationLabel: "翻译成西班牙语",
      translationEmpty: "这里会显示西班牙语翻译。",
      recordLabelIdle: "说话",
      recordLabelRecording: "在听",
      recordLabelProcessing: "翻译中",
      playLabel: "播放",
      playingLabel: "播放中",
      splitTitle: "中文",
      splitSubtitle: "Habla en chino",
    };
  }

  return {
    heroTitle: "Habla en español",
    heroHintIdle: "Toca una vez para hablar. Toca otra vez para traducir.",
    heroHintRecording: "Pulsa otra vez para detener y traducir.",
    heroHintProcessing: "Procesando audio, texto y voz.",
    statusIdle: "En espera",
    statusRecording: "Escuchando",
    statusProcessing: "Traduciendo",
    statusReady: "Listo",
    statusError: "Error",
    transcriptLabel: "Texto detectado en español",
    transcriptEmpty: "Aquí aparecerá la transcripción en español.",
    translationLabel: "Traducido al chino",
    translationEmpty: "Aquí aparecerá la traducción final en chino.",
    recordLabelIdle: "Hablar",
    recordLabelRecording: "Escucha",
    recordLabelProcessing: "Traduciendo",
    playLabel: "Reproducir",
    playingLabel: "Sonando",
    splitTitle: "Español",
    splitSubtitle: "Habla en español",
  };
}

function floatingModeLabel(mode: Mode): string {
  return mode === "walkie" ? "Diálogo" : "Walkie";
}

function floatingModeIcon(mode: Mode) {
  if (mode === "walkie") {
    return (
      <svg className="floating-mode-svg" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
        <path d="M7 8.2c0-2 1.7-3.7 3.8-3.7h6.4c2.1 0 3.8 1.7 3.8 3.7v4.9c0 2-1.7 3.7-3.8 3.7h-4.1l-4.9 4.1v-4.1h-.3C5.7 16.8 4 15.1 4 13.1V8.2Z" />
        <path d="M14.8 19.1h3.4l3.8 3.2v-3.2h.3c1.6 0 2.9-1.2 2.9-2.8v-3.6c0-1.2-.8-2.3-1.9-2.7" />
      </svg>
    );
  }

  return (
    <svg className="floating-mode-svg" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <path d="M9.2 4.8h4.1c1.4 0 2.5 1.1 2.5 2.5v8.1c0 1.4-1.1 2.5-2.5 2.5H9.2c-1.4 0-2.5-1.1-2.5-2.5V7.3c0-1.4 1.1-2.5 2.5-2.5Z" />
      <path d="M10.3 7.3h2.1" />
      <path d="M11.3 18v4.1" />
      <path d="M7.9 22.1h6.7" />
      <path d="M19 8.1c1.5 1.4 2.3 3.4 2.3 5.6s-.8 4.2-2.3 5.6" />
      <path d="M22.2 5.4c2.1 2.1 3.3 5 3.3 8.3s-1.2 6.2-3.3 8.3" />
    </svg>
  );
}

function statusLabel(phase: PanelPhase, copy: DirectionCopy): string {
  switch (phase) {
    case "recording":
      return copy.statusRecording;
    case "processing":
      return copy.statusProcessing;
    case "ready":
      return copy.statusReady;
    case "error":
      return copy.statusError;
    default:
      return copy.statusIdle;
  }
}

function recordLabel(phase: PanelPhase, copy: DirectionCopy): string {
  switch (phase) {
    case "recording":
      return copy.recordLabelRecording;
    case "processing":
      return copy.recordLabelProcessing;
    default:
      return copy.recordLabelIdle;
  }
}

function buildBlobUrl(base64Audio?: string | null, contentType?: string | null): string | null {
  if (!base64Audio) {
    return null;
  }

  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return URL.createObjectURL(new Blob([bytes], { type: contentType || "audio/wav" }));
}

async function sendTurn(blob: Blob, direction: Direction, speakEnabled: boolean): Promise<TurnResponse> {
  const formData = new FormData();
  formData.append("direction", direction);
  formData.append("speak", speakEnabled ? "true" : "false");
  formData.append("audio", blob, "turn.webm");

  const response = await fetch("/api/turn", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "La traducción no ha respondido correctamente.");
  }

  return (await response.json()) as TurnResponse;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function microphoneAvailabilityError(): string | null {
  if (typeof navigator === "undefined") {
    return "No se pudo inicializar el navegador.";
  }

  if (!window.isSecureContext) {
    return "El microfono solo funciona en HTTPS o en localhost. Abre la app con HTTPS o usa localhost en este dispositivo.";
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return "Este navegador no expone la API de microfono.";
  }

  if (typeof MediaRecorder === "undefined") {
    return "Este navegador no soporta grabacion de audio en web.";
  }

  return null;
}

export default function App() {
  const [mode, setMode] = useState<Mode>("walkie");
  const [walkieDirection, setWalkieDirection] = useState<Direction>("zh_to_es");
  const [splitTopLanguage, setSplitTopLanguage] = useState<"zh" | "es">("zh");
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<PanelKey | null>(null);
  const [playingKey, setPlayingKey] = useState<PanelKey | null>(null);
  const [lastSplitSource, setLastSplitSource] = useState<Side | null>(null);
  const [panels, setPanels] = useState<Record<PanelKey, PanelState>>({
    walkie: INITIAL_PANEL,
    top: INITIAL_PANEL,
    bottom: INITIAL_PANEL,
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const captureTargetRef = useRef<CaptureTarget | null>(null);
  const panelsRef = useRef(panels);
  const busyRef = useRef(false);

  const isBusy = activeKey !== null;
  const topDirection = splitTopLanguage === "zh" ? "zh_to_es" : "es_to_zh";
  const bottomDirection = topDirection === "zh_to_es" ? "es_to_zh" : "zh_to_es";
  const walkieCopy = directionCopy(walkieDirection);
  const topCopy = directionCopy(topDirection);
  const bottomCopy = directionCopy(bottomDirection);

  useEffect(() => {
    panelsRef.current = panels;
  }, [panels]);

  useEffect(() => {
    return () => {
      const currentAudio = audioRef.current;
      if (currentAudio) {
        audioRef.current = null;
        currentAudio.pause();
        currentAudio.src = "";
      }
      Object.values(panelsRef.current).forEach((panel) => {
        if (panel.audioUrl) {
          URL.revokeObjectURL(panel.audioUrl);
        }
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function updatePanel(key: PanelKey, updater: PanelState | ((current: PanelState) => PanelState)) {
    setPanels((current) => {
      const previous = current[key];
      const next = typeof updater === "function" ? updater(previous) : updater;

      if (previous.audioUrl && previous.audioUrl !== next.audioUrl) {
        URL.revokeObjectURL(previous.audioUrl);
      }

      return {
        ...current,
        [key]: next,
      };
    });
  }

  function stopCurrentAudio() {
    const currentAudio = audioRef.current;
    if (!currentAudio) {
      setPlayingKey(null);
      return;
    }

    audioRef.current = null;
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.src = "";
    setPlayingKey(null);
  }

  async function playAudioUrl(key: PanelKey, audioUrl: string): Promise<boolean> {
    stopCurrentAudio();

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setPlayingKey(key);

    const clearPlayback = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      setPlayingKey((current) => (current === key ? null : current));
    };

    audio.onended = clearPlayback;
    audio.onerror = clearPlayback;

    try {
      await audio.play();
      return true;
    } catch {
      clearPlayback();
      return false;
    }
  }

  function applySplitTurn(source: Side, payload: TurnResponse, audioUrl: string | null) {
    const target: Side = source === "top" ? "bottom" : "top";

    updatePanel(source, {
      phase: "ready",
      transcript: payload.transcript,
      translation: payload.translation,
      error: null,
      audioUrl: null,
    });

    updatePanel(target, {
      phase: "ready",
      transcript: payload.transcript,
      translation: payload.translation,
      error: null,
      audioUrl,
    });

    setLastSplitSource(source);
  }

  async function startCapture(target: CaptureTarget) {
    if (busyRef.current || isBusy) {
      return;
    }
    busyRef.current = true;

    const availabilityError = microphoneAvailabilityError();
    if (availabilityError) {
      updatePanel(target.key, {
        ...INITIAL_PANEL,
        phase: "error",
        error: availabilityError,
      });
      busyRef.current = false;
      return;
    }

    updatePanel(target.key, (current) => ({
      ...current,
      phase: "recording",
      error: null,
    }));
    setActiveKey(target.key);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      captureTargetRef.current = target;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", async () => {
        const currentTarget = captureTargetRef.current;
        const currentStream = streamRef.current;
        streamRef.current = null;
        currentStream?.getTracks().forEach((track) => track.stop());

        if (!currentTarget) {
          setActiveKey(null);
          return;
        }

        updatePanel(currentTarget.key, (current) => ({
          ...current,
          phase: "processing",
        }));

        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const payload = await sendTurn(blob, currentTarget.direction, speakEnabled);
          const audioUrl = buildBlobUrl(payload.audio_base64, payload.audio_content_type);

          if (currentTarget.key === "walkie") {
            updatePanel(currentTarget.key, {
              phase: "ready",
              transcript: payload.transcript,
              translation: payload.translation,
              error: null,
              audioUrl,
            });

            if (audioUrl && speakEnabled) {
              void playAudioUrl("walkie", audioUrl);
            }
          } else {
            applySplitTurn(currentTarget.key, payload, audioUrl);

            const playbackKey = currentTarget.key === "top" ? "bottom" : "top";
            if (audioUrl && speakEnabled) {
              void playAudioUrl(playbackKey, audioUrl);
            }
          }
        } catch (error) {
          updatePanel(currentTarget.key, (current) => ({
            ...current,
            phase: "error",
            error: error instanceof Error ? error.message : "No se pudo procesar el turno.",
          }));
        } finally {
          recorderRef.current = null;
          captureTargetRef.current = null;
          chunksRef.current = [];
          busyRef.current = false;
          setActiveKey(null);
        }
      });

      recorder.start();
    } catch (error) {
      const message =
        error instanceof DOMException
          ? error.name === "NotAllowedError"
            ? "No se pudo acceder al microfono. Revisa el permiso del navegador para esta pagina."
            : error.name === "NotFoundError"
              ? "No se encontro ningun microfono disponible en este dispositivo."
              : error.message
          : error instanceof Error
            ? error.message
            : "No se pudo acceder al microfono.";

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      captureTargetRef.current = null;
      chunksRef.current = [];
      busyRef.current = false;
      setActiveKey(null);
      updatePanel(target.key, {
        ...INITIAL_PANEL,
        phase: "error",
        error: message,
      });
    }
  }

  function stopCapture() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function handleWalkieToggle() {
    const panel = panels.walkie;
    if (activeKey === "walkie" && panel.phase === "recording") {
      stopCapture();
      return;
    }

    void startCapture({
      key: "walkie",
      direction: walkieDirection,
    });
  }

  function handleSplitToggle(side: Side) {
    const key = side;
    const panel = panels[key];
    if (activeKey === key && panel.phase === "recording") {
      stopCapture();
      return;
    }

    const direction = side === "top" ? topDirection : bottomDirection;
    void startCapture({ key, direction });
  }

  async function playAudio(key: PanelKey) {
    const audioUrl = panels[key].audioUrl;
    if (!audioUrl) {
      return;
    }

    await playAudioUrl(key, audioUrl);
  }

  const walkieHint = useMemo(() => {
    if (walkieDirection === "zh_to_es") {
      if (panels.walkie.phase === "recording") {
        return walkieCopy.heroHintRecording;
      }
      if (panels.walkie.phase === "processing") {
        return walkieCopy.heroHintProcessing;
      }
      return walkieCopy.heroHintIdle;
    }

    if (panels.walkie.phase === "recording") {
      return walkieCopy.heroHintRecording;
    }
    if (panels.walkie.phase === "processing") {
      return walkieCopy.heroHintProcessing;
    }
    return walkieCopy.heroHintIdle;
  }, [panels.walkie.phase, walkieCopy, walkieDirection]);

  return (
    <main className={`app-shell app-shell-${mode}`}>
      <div className="background-orb background-orb-a" />
      <div className="background-orb background-orb-b" />

      <section className={`app-frame ${mode === "split" ? "app-frame-split" : ""}`}>
        {mode === "walkie" ? (
          <section className="walkie-layout panel-enter">
            <section className="walkie-card">
              <div className="walkie-section walkie-section-translation">
                <div className="walkie-section-header">
                  <span className="walkie-section-label">{walkieTranslationLabel(walkieDirection)}</span>
                  {panels.walkie.audioUrl ? (
                    <button
                      className={`mini-action ${playingKey === "walkie" ? "is-playing" : ""}`}
                      onClick={() => void playAudio("walkie")}
                      type="button"
                    >
                      {playingKey === "walkie" ? walkieCopy.playingLabel : walkieCopy.playLabel}
                    </button>
                  ) : null}
                </div>
                <p className={`walkie-section-text ${panels.walkie.translation ? "is-filled" : "is-empty"}`}>
                  {panels.walkie.translation || walkieTranslationEmpty(walkieDirection)}
                </p>
              </div>
              <div className="walkie-divider" />
              <div className="walkie-section walkie-section-transcript">
                <div className="walkie-section-header">
                  <span className="walkie-section-label">{walkieTranscriptLabel(walkieDirection)}</span>
                </div>
                <p className={`walkie-section-text ${panels.walkie.transcript ? "is-filled" : "is-empty"}`}>
                  {panels.walkie.transcript || walkieTranscriptEmpty(walkieDirection)}
                </p>
              </div>
            </section>

            <div className="walkie-action-bar">
              {panels.walkie.error ? (
                <p className="error-banner walkie-error">{panels.walkie.error}</p>
              ) : null}
              <button
                className={`record-button walkie-record-button is-${panels.walkie.phase}`}
                onClick={handleWalkieToggle}
                disabled={isBusy && activeKey !== "walkie" && panels.walkie.phase !== "processing"}
                aria-label={recordLabel(panels.walkie.phase, walkieCopy)}
                type="button"
              >
                <svg className="record-blob" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                  <path d="M 75.9 39.3 Q 98 50 75.9 60.7 Q 83.9 83.9 60.7 75.9 Q 50 98 39.3 75.9 Q 16.1 83.9 24.1 60.7 Q 2 50 24.1 39.3 Q 16.1 16.1 39.3 24.1 Q 50 2 60.7 24.1 Q 83.9 16.1 75.9 39.3 Z" />
                </svg>
                <span className="record-button-core" aria-hidden="true" />
              </button>
            </div>
          </section>
        ) : (
          <section className="split-layout panel-enter">
            <SplitPane
              side="top"
              title={topCopy.splitTitle}
              direction={topDirection}
              sourceDirection={lastSplitSource === "bottom" ? bottomDirection : topDirection}
              panel={panels.top}
              lastSource={lastSplitSource}
              isActive={activeKey === "top"}
              isBusy={isBusy && activeKey !== "top"}
              isPlaying={playingKey === "top"}
              onRecord={() => handleSplitToggle("top")}
              onPlay={() => void playAudio("top")}
            />

            <SplitPane
              side="bottom"
              title={bottomCopy.splitTitle}
              direction={bottomDirection}
              sourceDirection={lastSplitSource === "top" ? topDirection : bottomDirection}
              panel={panels.bottom}
              lastSource={lastSplitSource}
              isActive={activeKey === "bottom"}
              isBusy={isBusy && activeKey !== "bottom"}
              isPlaying={playingKey === "bottom"}
              onRecord={() => handleSplitToggle("bottom")}
              onPlay={() => void playAudio("bottom")}
            />
          </section>
        )}
      </section>

      <div className={`floating-settings ${settingsOpen ? "is-open" : ""}`}>
        {settingsOpen ? (
          <div className="floating-menu">
            <SegmentedControl
              value={mode}
              options={[
                { label: "Walkie", value: "walkie" },
                { label: "Split", value: "split" },
              ]}
              onChange={(value) => {
                setMode(value as Mode);
                setSettingsOpen(false);
              }}
              ariaLabel="Modo"
            />

            <button
              className={`voice-toggle ${speakEnabled ? "voice-toggle-on" : ""}`}
              onClick={() => setSpeakEnabled((current) => !current)}
              type="button"
            >
              Voz {speakEnabled ? "on" : "off"}
            </button>

            {mode === "split" ? (
              <button
                className="swap-button"
                onClick={() => setSplitTopLanguage((current) => (current === "zh" ? "es" : "zh"))}
                type="button"
                disabled={isBusy}
              >
                Cambiar lados
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          className="floating-settings-button"
          onClick={() => setSettingsOpen((current) => !current)}
          type="button"
          aria-expanded={settingsOpen}
          aria-label="Abrir ajustes"
        >
          <span className="floating-settings-icon" aria-hidden="true">
            {settingsOpen ? "×" : floatingModeIcon(mode)}
          </span>
          <span className="floating-settings-label">{settingsOpen ? "Cerrar" : floatingModeLabel(mode)}</span>
        </button>
      </div>
    </main>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: Array<{ label: React.ReactNode; value: string }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const activeIndex = options.findIndex((option) => option.value === value);

  return (
    <div className={`segmented-control ${className || ""}`.trim()} role="tablist" aria-label={ariaLabel || "Vista"}>
      <span
        className="segmented-thumb"
        style={{
          width: `${100 / options.length}%`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          className={`segmented-option ${option.value === value ? "is-selected" : ""}`}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TurnCard({
  accent,
  label,
  content,
  empty,
  actionLabel,
  actionActiveLabel,
  actionDisabled,
  isPlaying,
  onAction,
}: {
  accent: "terracotta" | "gold";
  label: string;
  content: string;
  empty: string;
  actionLabel?: string;
  actionActiveLabel?: string;
  actionDisabled?: boolean;
  isPlaying?: boolean;
  onAction?: () => void;
}) {
  return (
    <article className={`turn-card turn-card-${accent} ${content ? "card-filled" : ""}`}>
      <div className="turn-card-header">
        <span>{label}</span>
        {actionLabel ? (
          <button
            className={`mini-action ${isPlaying ? "is-playing" : ""}`}
            disabled={actionDisabled}
            onClick={onAction}
            type="button"
          >
            {isPlaying ? actionActiveLabel || "Sonando" : actionLabel}
          </button>
        ) : null}
      </div>
      <p>{content || empty}</p>
    </article>
  );
}

function SplitPane({
  side,
  title,
  direction,
  sourceDirection,
  panel,
  lastSource,
  isActive,
  isBusy,
  isPlaying,
  onRecord,
  onPlay,
}: {
  side: Side;
  title: string;
  direction: Direction;
  sourceDirection: Direction;
  panel: PanelState;
  lastSource: Side | null;
  isActive: boolean;
  isBusy: boolean;
  isPlaying: boolean;
  onRecord: () => void;
  onPlay: () => void;
}) {
  const copy = directionCopy(direction);
  const sourceCopy = directionCopy(sourceDirection);
  const isSourcePane = lastSource === null || lastSource === side;
  const primaryLabel = isSourcePane ? splitGenericTranscriptLabel(direction) : splitGenericTranslationLabel(sourceDirection);
  const primaryText = isSourcePane ? panel.transcript : panel.translation;
  const primaryEmpty = isSourcePane ? copy.transcriptEmpty : sourceCopy.translationEmpty;
  const secondaryLabel = isSourcePane ? sourceCopy.translationLabel : sourceCopy.transcriptLabel;
  const secondaryText = isSourcePane ? panel.translation : panel.transcript;

  return (
    <section className={`split-pane split-pane-${side} ${isActive ? "is-active" : ""}`}>
      <div className={`split-pane-inner ${side === "top" ? "rotated" : ""}`}>
        <div className="split-pane-header">
          <div>
            <span className="eyebrow">{title}</span>
            <h2>{primaryLabel}</h2>
          </div>
        </div>

        <div className="split-stage">
          <p className={`split-primary ${primaryText ? "is-filled" : "is-empty"}`}>{primaryText || primaryEmpty}</p>

          {secondaryText ? (
            <div className="split-secondary">
              <span>{secondaryLabel}</span>
              <p>{secondaryText}</p>
            </div>
          ) : null}
        </div>

        <div className="split-action-row">
          {panel.audioUrl ? (
            <button
              className={`mini-action split-play-action ${isPlaying ? "is-playing" : ""}`}
              onClick={onPlay}
              type="button"
            >
              {isPlaying ? copy.playingLabel : copy.playLabel}
            </button>
          ) : null}
          <button
            className={`record-button split-record-button is-${panel.phase}`}
            onClick={onRecord}
            disabled={isBusy}
            aria-label={recordLabel(panel.phase, copy)}
            type="button"
          >
            <svg className="record-blob" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <path d="M 75.9 39.3 Q 98 50 75.9 60.7 Q 83.9 83.9 60.7 75.9 Q 50 98 39.3 75.9 Q 16.1 83.9 24.1 60.7 Q 2 50 24.1 39.3 Q 16.1 16.1 39.3 24.1 Q 50 2 60.7 24.1 Q 83.9 16.1 75.9 39.3 Z" />
            </svg>
            <span className="record-button-core" aria-hidden="true" />
          </button>
        </div>

        {panel.error ? <p className="error-banner">{panel.error}</p> : null}
      </div>
    </section>
  );
}
