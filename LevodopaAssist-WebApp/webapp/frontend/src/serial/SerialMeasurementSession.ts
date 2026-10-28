import { createLineBreakTransformStream } from "./lineSplitter";
import { classifyLine, type SummaryFields } from "./parser";

export type SessionStatus =
  | "idle"
  | "requesting_port"
  | "port_open"
  | "listening"
  | "streaming"
  | "contractions_tail"
  | "summary_received"
  | "cancelled"
  | "disconnected"
  | "error";

export interface SerialMeasurementSessionHandlers {
  onStatusChange?: (status: SessionStatus) => void;
  onRawSample?: (value: number) => void;
  onContractionDetail?: (amplitude: number, durationMs: number) => void;
  onSummary?: (fields: SummaryFields) => void;
  onStalled?: () => void;
  onError?: (message: string) => void;
}

const BAUD_RATE = 115200;
// El firmware espera ~5s de estabilización + ~2s de calibración antes de la
// primera muestra cruda, así que el timeout deja margen extra sobre esos ~7s
// para cubrir además la reacción humana al pedir el reset del ESP32.
const STALLED_TIMEOUT_MS = 20000;

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/**
 * Maneja el ciclo de vida completo de una medición leída por Web Serial
 * desde el ESP32: pedir el puerto, abrirlo, leer línea por línea,
 * clasificar cada línea con classifyLine(), y notificar vía callbacks
 * hasta que llega la línea SUMMARY (fin de medición) o se cancela/desconecta.
 */
export class SerialMeasurementSession {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private readableClosed: Promise<void> | null = null;
  private status: SessionStatus = "idle";
  private stalledTimer: ReturnType<typeof setTimeout> | null = null;
  private receivedFirstSample = false;
  private disconnectHandler = (event: Event) => {
    if (event.target === this.port) {
      this.setStatus("disconnected");
      this.handlers.onError?.("Se perdió la conexión con el dispositivo.");
      void this.cleanup();
    }
  };

  private handlers: SerialMeasurementSessionHandlers;

  constructor(handlers: SerialMeasurementSessionHandlers) {
    this.handlers = handlers;
  }

  private setStatus(status: SessionStatus) {
    this.status = status;
    this.handlers.onStatusChange?.(status);
  }

  getStatus() {
    return this.status;
  }

  async requestPort(): Promise<void> {
    if (!isWebSerialSupported()) {
      throw new Error("Este navegador no soporta Web Serial. Usá Chrome o Edge de escritorio.");
    }
    this.setStatus("requesting_port");
    this.port = await navigator.serial.requestPort();
    navigator.serial.addEventListener("disconnect", this.disconnectHandler);
  }

  async start(): Promise<void> {
    if (!this.port) {
      throw new Error("No hay un puerto seleccionado. Llamá requestPort() primero.");
    }

    await this.port.open({ baudRate: BAUD_RATE });
    this.setStatus("port_open");

    const textDecoder = new TextDecoderStream();
    const writable = textDecoder.writable as unknown as WritableStream<Uint8Array>;
    this.readableClosed = this.port.readable!.pipeTo(writable).catch(() => {
      // Se espera que rechace al cancelar el reader; los errores reales ya
      // se reportan por el evento 'disconnect' o por el catch en readLoop().
    });

    this.reader = textDecoder.readable.pipeThrough(createLineBreakTransformStream()).getReader();

    this.setStatus("listening");
    this.armStalledTimer();
    void this.readLoop();
  }

  private armStalledTimer() {
    this.clearStalledTimer();
    this.stalledTimer = setTimeout(() => {
      this.handlers.onStalled?.();
    }, STALLED_TIMEOUT_MS);
  }

  private clearStalledTimer() {
    if (this.stalledTimer) {
      clearTimeout(this.stalledTimer);
      this.stalledTimer = null;
    }
  }

  private async readLoop() {
    if (!this.reader) return;

    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value === undefined) continue;

        this.handleLine(value);
      }
    } catch (err) {
      if (this.status !== "cancelled" && this.status !== "disconnected") {
        this.setStatus("error");
        this.handlers.onError?.(
          err instanceof Error ? err.message : "Error leyendo el puerto serie."
        );
      }
    }
  }

  private handleLine(raw: string) {
    const parsed = classifyLine(raw);

    switch (parsed.type) {
      case "EMPTY":
      case "UNKNOWN":
        return;

      case "RAW_SAMPLE":
        if (!this.receivedFirstSample) {
          this.receivedFirstSample = true;
        }
        if (this.status === "listening") {
          this.setStatus("streaming");
        }
        this.armStalledTimer();
        this.handlers.onRawSample?.(parsed.value);
        return;

      case "CONTRACTION_DETAIL":
        if (this.status === "streaming") {
          this.setStatus("contractions_tail");
        }
        this.armStalledTimer();
        this.handlers.onContractionDetail?.(parsed.amplitude, parsed.durationMs);
        return;

      case "SUMMARY":
        this.clearStalledTimer();
        this.setStatus("summary_received");
        this.handlers.onSummary?.(parsed.fields);
        void this.stopReading();
        return;
    }
  }

  /** Deja de leer pero no cierra el puerto (llamado tras SUMMARY). */
  private async stopReading(): Promise<void> {
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // ignorar: puede rechazar si el puerto ya se desconectó
      }
    }
    await this.readableClosed?.catch(() => {});
  }

  /** Cancela una medición en curso (antes de SUMMARY): no se guarda nada. */
  async cancel(): Promise<void> {
    this.clearStalledTimer();
    this.setStatus("cancelled");
    await this.cleanup();
  }

  /** Libera el puerto tras terminar (con o sin éxito). */
  async close(): Promise<void> {
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    this.clearStalledTimer();
    navigator.serial?.removeEventListener("disconnect", this.disconnectHandler);

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // ignorar
      }
      this.reader = null;
    }
    await this.readableClosed?.catch(() => {});

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // ignorar: puede fallar si el dispositivo ya se desconectó físicamente
      }
    }
  }
}
