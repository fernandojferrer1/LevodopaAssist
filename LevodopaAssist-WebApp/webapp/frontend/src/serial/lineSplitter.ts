/**
 * TransformStream que convierte un stream de texto plano en líneas completas.
 * Web Serial entrega los datos en chunks arbitrarios de bytes, no alineados
 * a saltos de línea, así que hace falta bufferear entre chunks.
 */
export class LineBreakTransformer {
  private buffer = "";

  transform(chunk: string, controller: TransformStreamDefaultController<string>) {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      controller.enqueue(line.replace(/\r$/, ""));
    }
  }

  flush(controller: TransformStreamDefaultController<string>) {
    if (this.buffer) {
      controller.enqueue(this.buffer.replace(/\r$/, ""));
    }
  }
}

export function createLineBreakTransformStream(): TransformStream<string, string> {
  const transformer = new LineBreakTransformer();
  return new TransformStream({
    transform: (chunk, controller) => transformer.transform(chunk, controller),
    flush: (controller) => transformer.flush(controller),
  });
}
