import { formsControllerUploadSignatureImage } from "@/app/api";
import {
  parseSignatureImageValue,
  type FormValues,
} from "@betterinternship/core/forms";

export async function withSubmittedSignatureImages(values: FormValues): Promise<FormValues> {
  const nextValues: FormValues = { ...values };

  for (const [field, value] of Object.entries(values)) {
    const signatureImage = parseSignatureImageValue(value);
    if (!signatureImage || signatureImage.image.storage !== "inline") continue;

    const result = await formsControllerUploadSignatureImage({
      source: signatureImage.source,
      dataUrl: signatureImage.image.dataUrl,
    });

    if (!result.value) {
      throw new Error("Signature image upload did not return a saved image.");
    }

    nextValues[field] = result.value;
  }

  return nextValues;
}
