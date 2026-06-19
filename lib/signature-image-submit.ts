import { formsControllerUploadSignatureImage } from "@/app/api";
import {
  isInlineSignatureImagePayload,
  parseSignatureImageValue,
  type FormValues,
} from "@betterinternship/core/forms";
import { resolveSignatureImageValue } from "@/lib/signed-url";

export async function withSubmittedSignatureImages(values: FormValues): Promise<FormValues> {
  const nextValues: FormValues = { ...values };

  for (const [field, value] of Object.entries(values)) {
    const signatureImage = parseSignatureImageValue(value);
    if (!signatureImage) continue;

    // Inline → upload to server, get bucket reference
    if (isInlineSignatureImagePayload(signatureImage.image)) {
      const result = await formsControllerUploadSignatureImage({
        source: signatureImage.source,
        dataUrl: signatureImage.image.dataUrl,
      });
      if (!result.value) {
        throw new Error("Signature image upload did not return a saved image.");
      }
      nextValues[field] = result.value;
      continue;
    }

    // Bucket → resolve fresh signed URL
    nextValues[field] = await resolveSignatureImageValue(value);
  }

  return nextValues;
}
