export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CroppedAvatarOptions {
  outputSize?: number;
  quality?: number;
  mimeType?: string;
}

export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

export async function getCroppedAvatarBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  options?: CroppedAvatarOptions
): Promise<Blob> {
  const outputSize = options?.outputSize ?? 512;
  const quality = options?.quality ?? 0.92;
  const mimeType = options?.mimeType ?? "image/jpeg";

  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado.");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Falha ao gerar imagem."));
      },
      mimeType,
      quality
    );
  });
}
